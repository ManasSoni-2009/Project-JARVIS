"""
jarvis/agents/browser_agent.py

Browser automation agent using browser-use + Playwright (headless Chromium).
Powered by the multi-provider LLM configured in settings.

Executes natural-language web tasks: searching, navigating, scraping, etc.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def _make_browser_llm(temperature: float = 0.2) -> Any:
    """Create a native browser-use LLM matching the active provider."""
    from jarvis.config import get_settings

    s = get_settings()
    provider = s.llm_provider
    model = s.flash_model

    if provider == "google":
        from browser_use.llm.google.chat import ChatGoogle
        if model == "gemini-3.5-flash" or not model:
            model = "gemini-2.5-flash"
        return ChatGoogle(model=model, api_key=s.gemini_api_key, temperature=temperature)
    elif provider == "openai":
        from browser_use.llm.openai.chat import ChatOpenAI
        if model == "gpt-5" or not model:
            model = "gpt-4o"
        return ChatOpenAI(model=model, api_key=s.openai_api_key, temperature=temperature)
    elif provider == "anthropic":
        from browser_use.llm.anthropic.chat import ChatAnthropic
        if not model or model.startswith("claude-sonnet-5"):
            model = "claude-3-5-sonnet-latest"
        return ChatAnthropic(model=model, api_key=s.anthropic_api_key, temperature=temperature)
    else:
        from browser_use.llm.openai.chat import ChatOpenAI
        return ChatOpenAI(
            model=s.chat_model or "openai/gpt-4o",
            api_key=s.openrouter_api_key,
            base_url=s.openrouter_base_url,
            temperature=temperature,
        )


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

        logger.info("Browser agent task: '%s'", task)

        # Use the native browser-use LLM wrapper
        llm = _make_browser_llm(temperature=0.2)

        try:
            agent = BrowserUseAgent(
                task=task,
                llm=llm,
                use_vision=True,
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
