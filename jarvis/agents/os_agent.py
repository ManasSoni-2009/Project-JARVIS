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

        Checks configured os_backend (openclaw vs gemini_vision).
        """
        from jarvis.config import get_settings
        from jarvis.dashboard.pill import show_pill, hide_pill

        s = get_settings()
        logger.info("OS agent task: '%s' (backend=%s)", task, s.os_backend)
        show_pill("OS Control")

        try:
            if s.os_backend == "openclaw" and _OPENCLAW_AVAILABLE:
                try:
                    result = await self._run_openclaw(task)
                    if result:
                        logger.info("OpenClaw result: '%s'", result[:100])
                        return result
                except Exception as exc:
                    logger.warning("OpenClaw failed, falling back to Gemini Vision: %s", exc)

            # Fallback / Default: Gemini Vision multi-step PyAutoGUI loop
            return await self._llm_guided_action(task)
        finally:
            hide_pill()

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

    # -- LLM-guided PyAutoGUI multi-step backend -------------------------

    async def _llm_guided_action(self, task: str) -> str:
        """Use the vision LLM to autonomously execute a multi-step task."""
        from langchain_core.messages import HumanMessage
        from jarvis.brain.supervisor import _make_llm
        from jarvis.dashboard.pill import check_pill_state

        if self._llm is None:
            self._llm = _make_llm(temperature=0.1)

        history: list[str] = []
        max_steps = 15

        for step in range(1, max_steps + 1):
            stopped = await check_pill_state()
            if stopped:
                return "OS task stopped by user via overlay pill."

            logger.info("OS agent step %d/%d for task: '%s'", step, max_steps, task)
            screenshot_b64 = await self._take_screenshot()

            history_str = "\n".join(f"Step {i+1}: {act}" for i, act in enumerate(history)) if history else "None yet."
            plan_prompt = (
                "You are controlling a Windows 11 desktop via PyAutoGUI.\n"
                f"Goal Task: {task}\n"
                f"Actions performed so far:\n{history_str}\n\n"
                "Look at the current screenshot and decide the NEXT SINGLE action to progress toward the goal.\n"
                "If the goal is fully achieved or visible on screen, return action='done'.\n"
                "If the task cannot be completed or has failed after retries, return action='error'.\n\n"
                "Respond ONLY as JSON -- no prose, no markdown fences:\n"
                '{"action": "click|type|key|open_app|scroll|describe|done|error", "params": {...}, "explanation": "..."}\n\n'
                'For click: params = {"x": int, "y": int}\n'
                'For type: params = {"text": "string"}\n'
                'For key: params = {"keys": ["ctrl", "c"]}\n'
                'For open_app: params = {"app": "notepad|chrome|explorer|..."}\n'
                'For scroll: params = {"clicks": int, "x": int, "y": int} (positive clicks scrolls up, negative down)\n'
                'For describe: params = {"description": "what I see on screen"}\n'
                'For done: params = {"summary": "what was accomplished"}\n'
                'For error: params = {"reason": "why it failed"}\n'
            )

            messages = [
                HumanMessage(
                    content=[
                        {"type": "text", "text": plan_prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{screenshot_b64}",
                            },
                        },
                    ]
                )
            ]

            try:
                response = await self._llm.ainvoke(messages)
                raw = extract_text(response)

                if "```" in raw:
                    raw = raw.split("```")[1].lstrip("json").strip()

                plan = json.loads(raw)
                action = plan.get("action", "describe")
                params = plan.get("params", {})
                explanation = plan.get("explanation", "")

                if action == "done":
                    summary = params.get("summary", explanation or "Task completed successfully.")
                    logger.info("OS agent completed task: %s", summary)
                    return f"Completed: {summary}"
                if action == "error":
                    reason = params.get("reason", explanation or "Unknown error occurred.")
                    logger.warning("OS agent reported error: %s", reason)
                    return f"Failed: {reason}"

                res = await self._execute_action(plan)
                history.append(res)
                await asyncio.sleep(0.8)
            except Exception as exc:
                logger.exception("OS agent LLM error on step %d: %s", step, exc)
                history.append(f"Step {step} error: {exc}")
                await asyncio.sleep(0.8)

        return "OS task finished after reaching max steps (15). Last action: " + (history[-1] if history else "None")

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
                pyautogui.write(text, interval=0.03)
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

            if action == "scroll":
                clicks = params.get("clicks", -3)
                x = params.get("x")
                y = params.get("y")
                if x is not None and y is not None:
                    pyautogui.scroll(clicks, x=x, y=y)
                else:
                    pyautogui.scroll(clicks)
                return "Scrolled %d clicks. %s" % (clicks, explanation)

            if action == "describe":
                return params.get("description", "Screen described.")

            return "Unknown action: %s" % action

        return await asyncio.get_event_loop().run_in_executor(None, _act)
