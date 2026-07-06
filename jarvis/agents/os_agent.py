"""
jarvis/agents/os_agent.py

OS Control Agent with OpenClaw integration.
Routes commands through the OpenClaw CLI subprocess when available,
falls back to PyAutoGUI for direct screen interaction.

Capabilities:
  - Take screenshots and analyse the screen via vision LLM
  - Click coordinates or UI elements by description
  - Type text, press keyboard shortcuts
  - Open / close applications
  - Route complex commands through OpenClaw
"""

from __future__ import annotations

import asyncio
import base64
import io
import json
import logging
import shutil

from jarvis.brain.supervisor import extract_text

logger = logging.getLogger(__name__)

# Check once at import time whether OpenClaw is available
_OPENCLAW_AVAILABLE: bool = shutil.which("openclaw") is not None


class OSAgent:
    """OS control agent with OpenClaw + PyAutoGUI backends.

    Uses the multi-provider LLM for reasoning about screen state.
    """

    def __init__(self) -> None:
        self._llm = None

    async def execute(self, task: str) -> str:
        """Execute an OS task described in natural language.

        Tries OpenClaw first (if installed), then falls back to
        LLM-guided PyAutoGUI actions.
        """
        logger.info("OS agent task: '%s'", task)

        # Try OpenClaw for structured commands first
        if _OPENCLAW_AVAILABLE:
            try:
                result = await self._run_openclaw(task)
                if result:
                    logger.info("OpenClaw result: '%s'", result[:100])
                    return result
            except Exception as exc:
                logger.warning("OpenClaw failed, falling back to PyAutoGUI: %s", exc)

        # Fallback: LLM-guided PyAutoGUI
        return await self._llm_guided_action(task)

    # -- OpenClaw backend -------------------------------------------------

    async def _run_openclaw(self, task: str) -> str:
        """Route a command through the OpenClaw CLI subprocess."""
        try:
            proc = await asyncio.create_subprocess_exec(
                "openclaw", "run", "--task", task,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=60.0
            )

            if proc.returncode != 0:
                err_msg = stderr.decode("utf-8", errors="replace").strip()
                logger.warning("OpenClaw exited with code %d: %s", proc.returncode, err_msg[:200])
                return ""

            output = stdout.decode("utf-8", errors="replace").strip()
            return output if output else ""

        except asyncio.TimeoutError:
            logger.error("OpenClaw timed out after 60s")
            return ""
        except FileNotFoundError:
            logger.warning("OpenClaw binary not found on PATH")
            return ""

    # -- LLM-guided PyAutoGUI backend ------------------------------------

    async def _llm_guided_action(self, task: str) -> str:
        """Use the vision LLM to plan an action, then execute via PyAutoGUI."""
        from langchain_core.messages import HumanMessage

        from jarvis.brain.supervisor import _make_llm

        if self._llm is None:
            self._llm = _make_llm(temperature=0.1)

        # Take a screenshot
        screenshot_b64 = await self._take_screenshot()

        plan_prompt = (
            "You are controlling a Windows 11 desktop via PyAutoGUI.\n"
            "Task: %s\n\n"
            "Look at the current screenshot and decide:\n"
            "1. What action to take (click, type, key, open_app, or describe)\n"
            "2. The exact parameters\n\n"
            "Respond ONLY as JSON -- no prose, no markdown fences:\n"
            '{"action": "click|type|key|open_app|describe", "params": {...}, '
            '"explanation": "..."}\n\n'
            'For click: params = {"x": int, "y": int}\n'
            'For type: params = {"text": "string"}\n'
            'For key: params = {"keys": ["ctrl", "c"]}\n'
            'For open_app: params = {"app": "notepad|chrome|explorer|..."}\n'
            'For describe: params = {"description": "what I see on screen"}\n'
        ) % task

        messages = [
            HumanMessage(
                content=[
                    {"type": "text", "text": plan_prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": "data:image/png;base64,%s" % screenshot_b64,
                        },
                    },
                ]
            )
        ]

        try:
            response = await self._llm.ainvoke(messages)
            raw = extract_text(response)

            # Strip markdown fences if present
            if "```" in raw:
                raw = raw.split("```")[1].lstrip("json").strip()

            plan = json.loads(raw)
            return await self._execute_action(plan)

        except Exception as exc:
            logger.exception("OS agent LLM error: %s", exc)
            return "OS control failed: %s" % exc

    async def _take_screenshot(self) -> str:
        """Take a screenshot and return as a base64-encoded PNG string."""

        def _shot() -> str:
            import pyautogui

            img = pyautogui.screenshot()
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            return base64.b64encode(buf.getvalue()).decode("ascii")

        return await asyncio.get_event_loop().run_in_executor(None, _shot)

    async def _execute_action(self, plan: dict) -> str:
        """Execute the action decided by the vision LLM via PyAutoGUI."""
        action = plan.get("action", "describe")
        params = plan.get("params", {})
        explanation = plan.get("explanation", "")

        def _act() -> str:
            import pyautogui

            if action == "click":
                x, y = params.get("x", 0), params.get("y", 0)
                pyautogui.click(x, y)
                return "Clicked at (%d, %d). %s" % (x, y, explanation)

            if action == "type":
                text = params.get("text", "")
                pyautogui.write(text, interval=0.05)
                return "Typed: '%s'. %s" % (text, explanation)

            if action == "key":
                keys = params.get("keys", [])
                pyautogui.hotkey(*keys)
                return "Pressed: %s. %s" % ("+".join(keys), explanation)

            if action == "open_app":
                import subprocess

                app = params.get("app", "")
                subprocess.Popen(["start", app], shell=True)
                return "Opened: %s. %s" % (app, explanation)

            if action == "describe":
                return params.get("description", "Screen described.")

            return "Unknown action: %s" % action

        return await asyncio.get_event_loop().run_in_executor(None, _act)
