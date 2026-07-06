"""
tests/test_phase2_browser.py

Phase 2 Gate Tests: Browser agent.
Verifies:
  - Browser agent can navigate to a URL
  - Page title can be extracted
  - Search query execution works
"""

import pytest


@pytest.mark.asyncio
async def test_browser_navigates_to_example_com():
    """Browser agent should navigate to example.com and return a result."""
    from jarvis.agents.browser_agent import BrowserAgent

    agent = BrowserAgent()
    result = await agent.execute("Go to https://example.com and return the page title")
    print(f"\n  Browser result: '{result[:100]}'")
    assert isinstance(result, str), "Browser agent should return a string"
    assert len(result) > 0, "Browser agent returned empty result"
    # example.com has "Example Domain" in its content
    assert "example" in result.lower() or "domain" in result.lower(), \
        f"Expected 'example' in result, got: {result}"


@pytest.mark.asyncio
async def test_browser_search_returns_url():
    """Browser agent should be able to search and find a URL."""
    from jarvis.agents.browser_agent import BrowserAgent

    agent = BrowserAgent()
    result = await agent.execute("Search DuckDuckGo for 'Python programming language' and return the first result URL")
    print(f"\n  Search result: '{result[:150]}'")
    assert isinstance(result, str)
    assert len(result) > 5, "Expected a non-trivial result"


@pytest.mark.asyncio
async def test_browser_handles_invalid_task_gracefully():
    """Browser agent should return an error string, not raise an exception."""
    from jarvis.agents.browser_agent import BrowserAgent

    agent = BrowserAgent()
    # This should complete without throwing
    result = await agent.execute("Navigate to this-domain-does-not-exist-xyz-123.com")
    assert isinstance(result, str), "Should return a string even on failure"
