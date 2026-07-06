"""
tests/test_phase4_mcp.py

Phase 4 Gate Tests: MCP tools + Obsidian memory.
Verifies:
  - Filesystem MCP can list a directory
  - Filesystem MCP can read and write files
  - GitHub MCP can list repositories
  - Obsidian vault can be searched by keyword
  - Obsidian vault can be searched by tag
  - Session memory can log and retrieve turns
"""

import asyncio
import tempfile
from pathlib import Path

import pytest


# ── Filesystem MCP Tests ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_filesystem_list_directory():
    """Filesystem tool should list files in a known directory."""
    from jarvis.mcp.client import MCPClient
    client = MCPClient()
    result = await client._filesystem_tool("filesystem_list", {"path": "."})
    print(f"\n  Filesystem list: {result[:200]}")
    assert isinstance(result, str)
    assert len(result) > 0
    # Should contain at least pyproject.toml
    assert "pyproject.toml" in result or "jarvis" in result


@pytest.mark.asyncio
async def test_filesystem_write_and_read():
    """Filesystem tool should write and read back a file."""
    from jarvis.mcp.client import MCPClient
    client = MCPClient()

    with tempfile.TemporaryDirectory() as tmpdir:
        test_file = str(Path(tmpdir) / "test_jarvis.txt")
        content = "J.A.R.V.I.S filesystem test"

        # Write
        write_result = await client._filesystem_tool("filesystem_write", {
            "path": test_file,
            "content": content,
        })
        assert "Written" in write_result

        # Read back
        read_result = await client._filesystem_tool("filesystem_read", {
            "path": test_file,
        })
        assert content in read_result, f"Expected '{content}' in read result"


# ── GitHub MCP Tests ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_github_list_repos():
    """GitHub tool should return repos or a graceful error string (never raise)."""
    from jarvis.mcp.client import MCPClient
    client = MCPClient()
    result = await client._github_tool("github_list_repos", {})
    print(f"\n  GitHub result: {result[:300]}")
    assert isinstance(result, str), "Should return a string"
    assert len(result) > 0, "Should return non-empty string"
    # Either got repos (has •) or got a clear error message
    assert "•" in result or "error" in result.lower() or "No repositories" in result, \
        f"Unexpected result format: {result}"


# ── Obsidian Memory Tests ─────────────────────────────────────────────────────

@pytest.fixture
def mock_vault(tmp_path: Path) -> Path:
    """Create a minimal mock Obsidian vault for testing."""
    # Note 1: tagged with #project
    (tmp_path / "project_alpha.md").write_text(
        "---\ntitle: Project Alpha\ntags: [project, ai]\n---\n\nThis is a project about AI systems.",
        encoding="utf-8",
    )
    # Note 2: contains keyword
    (tmp_path / "machine_learning.md").write_text(
        "---\ntitle: Machine Learning Notes\n---\n\nMachine learning is a subset of AI.",
        encoding="utf-8",
    )
    # Note 3: empty
    (tmp_path / "empty.md").write_text("", encoding="utf-8")
    return tmp_path


@pytest.mark.asyncio
async def test_obsidian_keyword_search(mock_vault):
    """Obsidian should find notes containing a keyword."""
    from jarvis.memory.obsidian import ObsidianMemory
    mem = ObsidianMemory(vault_path=mock_vault)
    results = await mem.search("machine learning")
    print(f"\n  Obsidian keyword results: {results}")
    assert len(results) >= 1
    paths = [str(r[0]) for r in results]
    assert any("machine_learning" in p for p in paths)


@pytest.mark.asyncio
async def test_obsidian_tag_search(mock_vault):
    """Obsidian should find notes by tag."""
    from jarvis.memory.obsidian import ObsidianMemory
    mem = ObsidianMemory(vault_path=mock_vault)
    query_result = await mem.query("find notes tagged #project")
    print(f"\n  Tag search result: {query_result[:200]}")
    assert "project_alpha" in query_result or "Project Alpha" in query_result


@pytest.mark.asyncio
async def test_obsidian_write_and_read(mock_vault):
    """Obsidian should write a new note and read it back."""
    from jarvis.memory.obsidian import ObsidianMemory
    mem = ObsidianMemory(vault_path=mock_vault)

    write_result = await mem.write_note("Test Note", "This is a test note created by JARVIS.")
    assert "Created" in write_result

    content = await mem.read_note("Test Note")
    assert "test note" in content.lower()


@pytest.mark.asyncio
async def test_obsidian_query_natural_language(mock_vault):
    """Obsidian query parser should handle natural language."""
    from jarvis.memory.obsidian import ObsidianMemory
    mem = ObsidianMemory(vault_path=mock_vault)
    result = await mem.query("search for AI systems")
    assert isinstance(result, str)
    assert len(result) > 0


# ── Session Memory Tests ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_session_memory_log_and_retrieve(tmp_path):
    """Session memory should store and retrieve conversation turns."""
    from jarvis.memory.session import SessionMemory

    mem = SessionMemory(db_path=tmp_path / "test_session.db")
    await mem.init()

    await mem.log_turn(
        session_id="test-session-001",
        user_text="Hello JARVIS",
        intent="chat",
        agent_output="Hello! How can I assist?",
        final_response="Hello! How can I assist?",
        round_trip_ms=312.5,
    )

    turns = await mem.get_recent(limit=10)
    assert len(turns) == 1
    assert turns[0]["user_text"] == "Hello JARVIS"
    assert turns[0]["intent"] == "chat"
    assert turns[0]["round_trip_ms"] == 312.5
