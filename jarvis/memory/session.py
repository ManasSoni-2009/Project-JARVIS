"""
jarvis/memory/session.py

SQLite-backed in-session conversation log.
Stores every conversation turn with timestamps and intent metadata.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path

import aiosqlite

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).parent.parent.parent / "data" / "session.db"


class SessionMemory:
    """Async SQLite session log for conversation history."""

    def __init__(self, db_path: Path = DB_PATH) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

    async def init(self) -> None:
        """Create tables if they don't exist."""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS turns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    user_text TEXT NOT NULL,
                    intent TEXT,
                    agent_output TEXT,
                    final_response TEXT,
                    round_trip_ms REAL
                )
            """)
            await db.commit()
        logger.info("✅  Session DB initialized")

    async def log_turn(
        self,
        session_id: str,
        user_text: str,
        intent: str | None,
        agent_output: str,
        final_response: str,
        round_trip_ms: float = 0.0,
    ) -> None:
        """Log a completed conversation turn."""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT INTO turns 
                (session_id, timestamp, user_text, intent, agent_output, final_response, round_trip_ms)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                session_id,
                datetime.utcnow().isoformat(),
                user_text,
                intent,
                agent_output,
                final_response,
                round_trip_ms,
            ))
            await db.commit()

    async def get_recent(self, limit: int = 20) -> list[dict]:
        """Get the most recent conversation turns for the dashboard."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("""
                SELECT * FROM turns ORDER BY id DESC LIMIT ?
            """, (limit,)) as cursor:
                rows = await cursor.fetchall()
                return [dict(row) for row in reversed(rows)]
