"""
jarvis/agents/chat_agent.py

Conversational agent backed by the multi-provider LLM system.
Used for general knowledge, questions, calculations, etc.
Embodies the JARVIS personality from the MCU.
"""

from __future__ import annotations

import logging
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from jarvis.brain.prompts import CHAT_SYSTEM
from jarvis.brain.supervisor import extract_text

logger = logging.getLogger(__name__)


class ChatAgent:
    """Wraps the chat LLM for pure conversational responses."""

    def __init__(self, llm: Any) -> None:
        self._llm = llm

    async def run(self, user_text: str, history: list | None = None) -> str:
        """
        Generate a conversational response.
        Includes recent conversation history for context.
        """
        messages = [SystemMessage(content=CHAT_SYSTEM)]

        # Include up to last 6 messages of history for context
        if history:
            messages.extend(history[-6:])
        else:
            messages.append(HumanMessage(content=user_text))

        response = await self._llm.ainvoke(messages)
        text = extract_text(response)
        # Sanitize for Windows console
        text = text.encode("ascii", "ignore").decode("ascii").strip()
        if not text:
            text = "I seem to have lost my words. Could you try again?"
        logger.debug("Chat response: '%s'", text[:80])
        return text
