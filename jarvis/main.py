"""
jarvis/main.py

J.A.R.V.I.S v2.0 main entrypoint.
Starts all services concurrently:
  - FastAPI web dashboard (http://localhost:7779)
  - Pipeline (STT + Supervisor + TTS) -- request/response only, no background mic
  - Session memory database
"""

from __future__ import annotations

import asyncio
import logging
import sys

import uvicorn
from rich.console import Console
from rich.logging import RichHandler
from rich.panel import Panel
from rich.text import Text

# -- Logging setup ---------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    handlers=[RichHandler(rich_tracebacks=True, markup=True)],
)
logger = logging.getLogger("jarvis")
console = Console()


async def main() -> None:
    # Print banner
    banner = Text()
    banner.append("  J.A.R.V.I.S\n", style="bold cyan")
    banner.append("  Just A Rather Very Intelligent System\n", style="dim")
    banner.append("  v2.0.0 -- OpenClaw-Powered Agentic AI\n", style="dim")
    console.print(Panel(banner, border_style="cyan", expand=False))

    from jarvis.config import get_settings
    s = get_settings()
    console.print(f"[cyan]->[/cyan] Provider: [white]{s.llm_provider}[/white]")
    console.print(f"[cyan]->[/cyan] Model: [white]{s.flash_model}[/white]")
    console.print(f"[cyan]->[/cyan] Obsidian vault: [white]{s.obsidian_vault_path}[/white]")
    console.print(f"[cyan]->[/cyan] Dashboard: [white]http://localhost:{s.dashboard_port}[/white]")
    console.print()

    # -- Initialize components ---------------------------------------------
    from jarvis.transport.stt import STT
    from jarvis.transport.tts import KokoroTTS
    from jarvis.transport.pipeline import JarvisPipeline
    from jarvis.brain.supervisor import Supervisor
    from jarvis.memory.session import SessionMemory
    from jarvis.dashboard.server import create_app, broadcast_pipeline_event

    # Session memory
    session_mem = SessionMemory()
    await session_mem.init()

    # Build LangGraph supervisor
    supervisor = Supervisor()
    await supervisor.build()

    # Build STT (Faster-Whisper)
    console.print("[cyan]->[/cyan] Loading Faster-Whisper STT model...")
    stt = STT.from_settings()
    await stt.load()
    console.print("[green][OK][/green] Faster-Whisper STT ready")

    # Build TTS (Kokoro -- local neural voice)
    console.print("[cyan]->[/cyan] Loading Kokoro TTS model...")
    tts = KokoroTTS.from_settings()
    await tts.load()
    console.print("[green][OK][/green] Kokoro TTS ready")

    # Build the pipeline (request/response, no background loop)
    pipeline = JarvisPipeline(
        stt=stt,
        tts=tts,
        on_event=broadcast_pipeline_event,
    )
    pipeline.set_processor(supervisor.run)

    # -- Create FastAPI dashboard app --------------------------------------
    app = create_app(pipeline=pipeline)

    # Configure uvicorn to not block the event loop
    uv_config = uvicorn.Config(
        app,
        host=s.dashboard_host,
        port=s.dashboard_port,
        log_level="warning",
    )
    uv_server = uvicorn.Server(uv_config)

    # -- Run everything concurrently ---------------------------------------
    console.print("[green][OK][/green] Starting J.A.R.V.I.S v2.0...\n")

    try:
        await uv_server.serve()
    except (KeyboardInterrupt, asyncio.CancelledError):
        console.print("\n[yellow]Shutting down J.A.R.V.I.S...[/yellow]")


def run() -> None:
    """Entry point called by `jarvis` CLI command (from pyproject.toml)."""
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        console = Console()
        console.print("\n[yellow]J.A.R.V.I.S offline.[/yellow]")
        sys.exit(0)


if __name__ == "__main__":
    run()
