"""
jarvis/brain/state.py

Shared state that flows through the LangGraph supervisor graph.
Every node reads from and writes to AgentState.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal
from typing_extensions import TypedDict

from langgraph.graph.message import add_messages


Intent = Literal["chat", "browser", "os_control", "mcp_tool", "obsidian"]


class AgentState(TypedDict):
    # ── Input ────────────────────────────────────────────────
    user_text: str                        # Raw transcribed user command

    # ── Routing ──────────────────────────────────────────────
    intent: Intent | None                 # Classified intent
    intent_confidence: float              # 0.0 – 1.0

    # ── Execution ────────────────────────────────────────────
    agent_output: str                     # Raw output from the specialist agent
    final_response: str                   # Polished response for TTS

    # ── Context ──────────────────────────────────────────────
    messages: Annotated[list[Any], add_messages]  # Full conversation history
    session_id: str                       # Unique session identifier

    # ── Metadata ─────────────────────────────────────────────
    error: str | None                     # Error message if something failed
    tool_calls_made: list[str]            # List of tools invoked in this turn
