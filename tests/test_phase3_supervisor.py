"""
tests/test_phase3_supervisor.py

Phase 3 Gate Tests: LangGraph Supervisor routing.
Verifies that the supervisor correctly classifies user intents
and routes to the right specialist agent node.
"""

import pytest


@pytest.fixture(scope="module")
async def supervisor():
    """Build the supervisor once per test module."""
    from jarvis.brain.supervisor import Supervisor
    s = Supervisor()
    await s.build()
    return s


ROUTING_CASES = [
    # (user command,           expected_intent)
    ("what is the capital of France",       "chat"),
    ("tell me a joke",                       "chat"),
    ("open YouTube and search lo-fi music", "browser"),
    ("go to github.com",                    "browser"),
    ("click the start menu",               "os_control"),
    ("take a screenshot",                  "os_control"),
    ("list my github repositories",        "mcp_tool"),
    ("read the file readme.txt",           "mcp_tool"),
    ("find my notes about machine learning","obsidian"),
    ("search my vault for project notes",  "obsidian"),
]


@pytest.mark.asyncio
@pytest.mark.parametrize("command,expected_intent", ROUTING_CASES)
async def test_supervisor_routing(supervisor, command, expected_intent):
    """Supervisor should route each command to the correct intent."""
    from langchain_core.messages import HumanMessage
    from jarvis.brain.state import AgentState
    import uuid

    # Only run the classify_intent node (not full graph)
    state = {
        "user_text": command,
        "intent": None,
        "intent_confidence": 0.0,
        "agent_output": "",
        "final_response": "",
        "messages": [HumanMessage(content=command)],
        "session_id": str(uuid.uuid4()),
        "error": None,
        "tool_calls_made": [],
    }

    result = await supervisor._classify_intent(state)
    actual_intent = result.get("intent", "chat")
    confidence = result.get("intent_confidence", 0.0)

    print(f"\n  '{command}' -> {actual_intent} (conf={confidence:.2f}, expected={expected_intent})")
    assert actual_intent == expected_intent, \
        f"Command '{command}' should route to '{expected_intent}', got '{actual_intent}'"


@pytest.mark.asyncio
async def test_supervisor_end_to_end_chat():
    """Full end-to-end test: simple chat query should return a string response."""
    from jarvis.brain.supervisor import Supervisor
    s = Supervisor()
    await s.build()

    response = await s.run("What is two plus two?")
    print(f"\n  E2E chat response: '{response}'")
    assert isinstance(response, str)
    assert len(response) > 2
    # Should contain "4" or "four"
    assert "4" in response or "four" in response.lower(), \
        f"Expected math answer in: {response}"
