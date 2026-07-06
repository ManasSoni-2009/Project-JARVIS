"""
jarvis/memory/obsidian.py

Obsidian Second Brain integration.
Reads from the vault (D:\\JARVIS MEM) using filesystem access.
Supports:
  - Full-text search across all markdown notes
  - Dataview-style queries (tag search, property filters)
  - Reading a specific note by name
  - Writing/appending to notes
"""

from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Iterator

logger = logging.getLogger(__name__)


class ObsidianMemory:
    """
    Async interface to an Obsidian markdown vault.
    No Obsidian app needs to be running — pure filesystem access.
    """

    def __init__(self, vault_path: Path | None = None) -> None:
        if vault_path is None:
            from jarvis.config import get_settings
            vault_path = get_settings().obsidian_vault_path
        self.vault = Path(vault_path)
        logger.info(f"📓  Obsidian vault: {self.vault}")

    # ── Public API ────────────────────────────────────────────────────────────

    async def query(self, natural_query: str) -> str:
        """
        Parse a natural language query and return relevant note content.
        Supports: tag search, keyword search, note name lookup.
        """
        parsed = self._parse_query(natural_query)
        logger.debug(f"Obsidian query parsed: {parsed}")

        results = await asyncio.get_event_loop().run_in_executor(
            None, self._execute_query, parsed
        )

        if not results:
            return f"No notes found matching: '{natural_query}'"

        # Format results for TTS
        lines = [f"Found {len(results)} note(s):"]
        for note_path, excerpt in results[:5]:  # limit to 5 for voice
            lines.append(f"• {note_path.stem}: {excerpt[:150]}")

        return "\n".join(lines)

    async def read_note(self, note_name: str) -> str:
        """Read a specific note by name (fuzzy match)."""
        def _find_and_read():
            matches = list(self.vault.rglob(f"*{note_name}*.md"))
            if not matches:
                return f"Note '{note_name}' not found."
            note = matches[0]
            return note.read_text(encoding="utf-8")

        return await asyncio.get_event_loop().run_in_executor(None, _find_and_read)

    async def write_note(self, title: str, content: str, append: bool = False) -> str:
        """Create or append to a note."""
        def _write():
            filename = self.vault / f"{title}.md"
            if append and filename.exists():
                existing = filename.read_text(encoding="utf-8")
                filename.write_text(
                    existing + f"\n\n---\n*JARVIS added {datetime.now():%Y-%m-%d %H:%M}*\n{content}",
                    encoding="utf-8",
                )
                return f"Appended to '{title}.md'"
            else:
                frontmatter = f"---\ntitle: {title}\ncreated: {datetime.now():%Y-%m-%d}\ntags: [jarvis]\n---\n\n"
                filename.write_text(frontmatter + content, encoding="utf-8")
                return f"Created note '{title}.md'"

        return await asyncio.get_event_loop().run_in_executor(None, _write)

    async def search(self, keyword: str) -> list[tuple[Path, str]]:
        """Search for notes containing a keyword."""
        return await asyncio.get_event_loop().run_in_executor(
            None, self._keyword_search, keyword
        )

    # ── Private helpers ───────────────────────────────────────────────────────

    def _parse_query(self, text: str) -> dict:
        """
        Parse natural language into a structured query.
        Examples:
          "find notes tagged #project" → {type: tag, value: "project"}
          "search for machine learning" → {type: keyword, value: "machine learning"}
          "read my note about Python" → {type: note_name, value: "Python"}
        """
        text_lower = text.lower()

        # Tag query: "tagged #X" or "with tag X"
        tag_match = re.search(r"(?:tagged?|tag)\s+#?(\w+)", text_lower)
        if tag_match:
            return {"type": "tag", "value": tag_match.group(1)}

        # Property/dataview: "where X = Y"
        prop_match = re.search(r"where\s+(\w+)\s*[=:]\s*(\S+)", text_lower)
        if prop_match:
            return {"type": "property", "key": prop_match.group(1), "value": prop_match.group(2)}

        # Note name: "read/open note about/called X"
        note_match = re.search(r"(?:read|open|show|get).*?(?:note|notes?)\s+(?:about|called|named|on)?\s*['\"]?(.+?)['\"]?$", text_lower)
        if note_match:
            return {"type": "note_name", "value": note_match.group(1).strip()}

        # Default: keyword search
        # Strip common filler words
        keywords = re.sub(r"\b(find|search|look for|notes?|my|about|in|obsidian)\b", "", text_lower).strip()
        return {"type": "keyword", "value": keywords or text}

    def _execute_query(self, query: dict) -> list[tuple[Path, str]]:
        """Execute the structured query against the vault."""
        q_type = query.get("type", "keyword")

        if q_type == "tag":
            return self._tag_search(query["value"])
        elif q_type == "property":
            return self._property_search(query["key"], query["value"])
        elif q_type == "note_name":
            matches = list(self.vault.rglob(f"*{query['value']}*.md"))
            return [(m, self._excerpt(m)) for m in matches[:10]]
        else:
            return self._keyword_search(query.get("value", ""))

    def _keyword_search(self, keyword: str) -> list[tuple[Path, str]]:
        """Full-text keyword search across all notes."""
        results = []
        keyword_lower = keyword.lower()
        for md_file in self._all_notes():
            try:
                content = md_file.read_text(encoding="utf-8", errors="ignore")
                if keyword_lower in content.lower():
                    excerpt = self._find_excerpt(content, keyword_lower)
                    results.append((md_file, excerpt))
            except Exception:
                pass
        return results

    def _tag_search(self, tag: str) -> list[tuple[Path, str]]:
        """Find notes containing a specific Obsidian tag (#tag or tags: in frontmatter)."""
        results = []
        tag_patterns = [f"#{tag}", f"tags: [{tag}", f"tags:\n  - {tag}"]
        for md_file in self._all_notes():
            try:
                content = md_file.read_text(encoding="utf-8", errors="ignore")
                if any(p in content.lower() for p in tag_patterns):
                    results.append((md_file, self._excerpt(md_file)))
            except Exception:
                pass
        return results

    def _property_search(self, key: str, value: str) -> list[tuple[Path, str]]:
        """Search for notes with a specific YAML frontmatter property."""
        results = []
        pattern = re.compile(rf"^{re.escape(key)}\s*:\s*{re.escape(value)}", re.MULTILINE | re.IGNORECASE)
        for md_file in self._all_notes():
            try:
                content = md_file.read_text(encoding="utf-8", errors="ignore")
                if pattern.search(content):
                    results.append((md_file, self._excerpt(md_file)))
            except Exception:
                pass
        return results

    def _all_notes(self) -> Iterator[Path]:
        """Iterate all .md files in the vault (excludes hidden dirs)."""
        for f in self.vault.rglob("*.md"):
            if not any(p.startswith(".") for p in f.parts):
                yield f

    def _excerpt(self, path: Path, max_chars: int = 200) -> str:
        """Return the first meaningful content from a note (skips frontmatter)."""
        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
            # Skip YAML frontmatter
            if content.startswith("---"):
                end = content.find("---", 3)
                if end > 0:
                    content = content[end + 3:].strip()
            return content[:max_chars].replace("\n", " ")
        except Exception:
            return ""

    def _find_excerpt(self, content: str, keyword: str, context: int = 100) -> str:
        """Return the text around the first occurrence of the keyword."""
        idx = content.lower().find(keyword)
        if idx < 0:
            return content[:100]
        start = max(0, idx - context)
        end = min(len(content), idx + len(keyword) + context)
        return f"…{content[start:end]}…"
