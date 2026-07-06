"""
jarvis/brain/supervisor.py

LangGraph StateGraph that:
  1. Classifies user intent via the supervisor LLM (classify_intent node)
  2. Routes to the correct specialist agent node
  3. Polishes the raw output into a natural spoken response
  4. Returns the final response string

The _make_llm() factory supports multiple LLM providers (Google, OpenAI,
Anthropic, OpenRouter) based on the active configuration.

Usage:
    supervisor = Supervisor()
    await supervisor.build()
    response = await supervisor.run("open youtube")
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, StateGraph

from jarvis.brain.prompts import (
    CHAT_SYSTEM,
    RESPONSE_POLISH_SYSTEM,
    SUPERVISOR_SYSTEM,
    build_classification_prompt,
    build_response_polish_prompt,
)
from jarvis.brain.state import AgentState, Intent
from jarvis.config import get_settings

logger = logging.getLogger(__name__)


def extract_text(response: Any) -> str:
    """Safely extract text from an LLM response, handling multi-part lists."""
    content = getattr(response, "content", "")
    if isinstance(content, list):
        return " ".join(
            p.get("text", str(p)) if isinstance(p, dict) else str(p)
            for p in content
        ).strip()
    return str(content).strip()


def _make_llm(model: str | None = None, temperature: float = 0.1) -> Any:
    """Create a LangChain chat LLM for the configured provider.

    Supports google, openai, anthropic, and openrouter backends.
    Returns the appropriate ChatModel instance.
    """
    s = get_settings()
    model = model or s.flash_model
    key = s.active_api_key

    if s.llm_provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI

        llm = ChatGoogleGenerativeAI(
            model=model,
            google_api_key=key,
            temperature=temperature,
            max_retries=4,
            timeout=30.0,
        )

    elif s.llm_provider == "openai":
        from langchain_openai import ChatOpenAI

        llm = ChatOpenAI(
            model=model,
            openai_api_key=key,
            temperature=temperature,
            max_retries=4,
            request_timeout=30.0,
        )

    elif s.llm_provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        llm = ChatAnthropic(
            model=model,
            anthropic_api_key=key,
            temperature=temperature,
            max_retries=4,
            timeout=30.0,
        )

    else:
        # openrouter -- uses ChatOpenAI with custom base URL
        from langchain_openai import ChatOpenAI

        llm = ChatOpenAI(
            model=model,
            openai_api_key=key,
            openai_api_base=s.openrouter_base_url,
            temperature=temperature,
            max_retries=4,
            request_timeout=30.0,
            default_headers=s.openrouter_headers,
        )

    def _safe_setattr(obj, name, val):
        try:
            setattr(obj, name, val)
        except Exception:
            try:
                object.__setattr__(obj, name, val)
            except Exception:
                try:
                    obj.__dict__[name] = val
                except Exception:
                    pass

    _safe_setattr(llm, "provider", s.llm_provider)
    _safe_setattr(llm, "model_name", getattr(llm, "model", model))
    return llm


class Supervisor:
    """LangGraph-based multi-agent supervisor.

    Build the graph once with build(), then call run() for each user command.
    """

    def __init__(self) -> None:
        self._graph = None
        self._supervisor_llm = None
        self._chat_llm = None
        self._polish_llm = None

    async def build(self) -> None:
        """Initialize LLMs, agents, and compile the StateGraph."""
        logger.info("Building LangGraph supervisor...")

        self._supervisor_llm = _make_llm(temperature=0.0)
        self._chat_llm = _make_llm(temperature=0.7)
        self._polish_llm = _make_llm(temperature=0.3)

        # Import agents lazily to avoid circular imports
        from jarvis.agents.browser_agent import BrowserAgent
        from jarvis.agents.chat_agent import ChatAgent
        from jarvis.agents.os_agent import OSAgent
        from jarvis.memory.obsidian import ObsidianMemory

        self._browser_agent = BrowserAgent()
        self._chat_agent = ChatAgent(self._chat_llm)
        self._os_agent = OSAgent()
        self._obsidian = ObsidianMemory()

        # -- Build the graph -----------------------------------------------
        graph = StateGraph(AgentState)

        graph.add_node("classify_intent", self._classify_intent)
        graph.add_node("chat_node", self._chat_node)
        graph.add_node("browser_node", self._browser_node)
        graph.add_node("os_node", self._os_node)
        graph.add_node("mcp_node", self._mcp_node)
        graph.add_node("obsidian_node", self._obsidian_node)
        graph.add_node("polish_response", self._polish_response)

        graph.set_entry_point("classify_intent")

        graph.add_conditional_edges(
            "classify_intent",
            self._route,
            {
                "chat": "chat_node",
                "browser": "browser_node",
                "os_control": "os_node",
                "mcp_tool": "mcp_node",
                "obsidian": "obsidian_node",
            },
        )

        for node in ("chat_node", "browser_node", "os_node", "mcp_node", "obsidian_node"):
            graph.add_edge(node, "polish_response")

        graph.add_edge("polish_response", END)

        self._graph = graph.compile()
        logger.info("[OK] LangGraph supervisor compiled")

    async def run(self, user_text: str) -> str:
        """Process a user command through the full graph and return a spoken response."""
        if self._graph is None:
            raise RuntimeError("Supervisor not built. Call build() first.")

        initial_state: AgentState = {
            "user_text": user_text,
            "intent": None,
            "intent_confidence": 0.0,
            "agent_output": "",
            "final_response": "",
            "messages": [HumanMessage(content=user_text)],
            "session_id": str(uuid.uuid4()),
            "error": None,
            "tool_calls_made": [],
        }

        result = await self._graph.ainvoke(initial_state)
        return result.get("final_response", "I'm sorry, I couldn't process that.")

    # -- Graph nodes -------------------------------------------------------

    async def _classify_intent(self, state: AgentState) -> dict:
        """Use the supervisor LLM to classify the user's intent."""
        messages = [
            SystemMessage(content=SUPERVISOR_SYSTEM),
            HumanMessage(content=build_classification_prompt(state["user_text"])),
        ]
        response = await self._supervisor_llm.ainvoke(messages)
        raw = extract_text(response)

        try:
            # Strip markdown fences if the model wraps output
            if "```" in raw:
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            parsed = json.loads(raw)
            intent = parsed.get("intent", "chat")
            confidence = float(parsed.get("confidence", 0.8))
            logger.info("Intent: %s (confidence=%.2f)", intent, confidence)
        except (json.JSONDecodeError, ValueError) as exc:
            logger.warning("Intent parse error: %s -- defaulting to chat", exc)
            intent = "chat"
            confidence = 0.5

        return {
            "intent": intent,
            "intent_confidence": confidence,
            "tool_calls_made": ["classify_intent"],
        }

    def _route(self, state: AgentState) -> Intent:
        """Edge routing function -- returns the node name to transition to."""
        return state.get("intent", "chat")

    async def _chat_node(self, state: AgentState) -> dict:
        """Handle conversational queries."""
        output = await self._chat_agent.run(state["user_text"], state["messages"])
        return {"agent_output": output, "tool_calls_made": state["tool_calls_made"] + ["chat"]}

    async def _browser_node(self, state: AgentState) -> dict:
        """Handle web browser tasks."""
        from jarvis.dashboard.pill import show_pill, hide_pill

        show_pill("Browser Task")
        try:
            output = await self._browser_agent.execute(state["user_text"])
        finally:
            hide_pill()
        return {"agent_output": output, "tool_calls_made": state["tool_calls_made"] + ["browser"]}

    async def _os_node(self, state: AgentState) -> dict:
        """Handle OS control tasks."""
        output = await self._os_agent.execute(state["user_text"])
        return {"agent_output": output, "tool_calls_made": state["tool_calls_made"] + ["os_control"]}

    async def _mcp_node(self, state: AgentState) -> dict:
        """Handle MCP tool calls (filesystem, GitHub)."""
        from jarvis.mcp.client import MCPClient

        client = MCPClient()
        output = await client.handle(state["user_text"])
        return {"agent_output": output, "tool_calls_made": state["tool_calls_made"] + ["mcp"]}

    async def _obsidian_node(self, state: AgentState) -> dict:
        """Handle Obsidian vault queries."""
        output = await self._obsidian.query(state["user_text"])
        return {"agent_output": output, "tool_calls_made": state["tool_calls_made"] + ["obsidian"]}

    async def _polish_response(self, state: AgentState) -> dict:
        """Convert raw agent output into a natural spoken response."""
        raw = state.get("agent_output", "")
        if not raw:
            return {"final_response": "Done."}

        # Short chat outputs are already conversational -- return as-is
        if state.get("intent") == "chat" and len(raw) < 200:
            return {"final_response": raw}

        messages = [
            SystemMessage(content=RESPONSE_POLISH_SYSTEM),
            HumanMessage(
                content=build_response_polish_prompt(raw, state.get("intent", "chat"))
            ),
        ]
        response = await self._polish_llm.ainvoke(messages)
        return {"final_response": extract_text(response)}
