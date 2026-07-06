"""
jarvis/agents/browser_agent.py

Browser automation agent using browser-use + Playwright (headless Chromium).
Powered by the multi-provider LLM configured in settings.

Executes natural-language web tasks: searching, navigating, scraping, etc.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


class BrowserAgent:
    """Wraps the browser-use Agent to execute web tasks.

    Each call spins up a headless Chromium instance via Playwright,
    executes the task, and returns a text summary.
    """

    def __init__(self) -> None:
        self._browser = None

    async def execute(self, task: str) -> str:
        """Execute a web task described in natural language.

        Returns a text summary of what was accomplished or found.
        """
        from browser_use import Agent as BrowserUseAgent

        from jarvis.brain.supervisor import _make_llm

        logger.info("Browser agent task: '%s'", task)

        # Use the multi-provider LLM -- browser agent needs a capable model
        llm = _make_llm(temperature=0.2)

        try:
            agent = BrowserUseAgent(
                task=task,
                llm=llm,
                use_vision=False,
                max_actions_per_step=5,
            )
            result = await agent.run(max_steps=15)

            # Robust result extraction with multiple fallbacks
            final_res = result.final_result()

            if not final_res:
                # Try extracted content
                ext = [
                    str(e)
                    for e in result.extracted_content()
                    if e and isinstance(e, str)
                ]
                if ext:
                    final_res = " ".join(ext)

            if not final_res:
                # Try visited URLs
                urls = result.urls()
                if urls:
                    final_res = "Navigated to: %s" % ", ".join(urls)

            output = str(final_res or "Task completed.")

            # Sanitize for ASCII-safe output
            output = output.encode("ascii", "replace").decode("ascii").strip()
            if not output:
                output = "Task completed."

            logger.info("Browser result: '%s'", output[:100])
            return output

        except Exception as exc:
            logger.exception("Browser agent error: %s", exc)
            return "Browser task failed: %s" % exc
