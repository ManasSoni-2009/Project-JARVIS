"""
jarvis/dashboard/server.py

FastAPI web dashboard for J.A.R.V.I.S v2.0.
Serves the Codex-style control panel at http://localhost:7779
Provides WebSocket for live text + audio streaming, settings API,
and conversation history.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

logger = logging.getLogger(__name__)

STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)

# Path to the project .env file (for settings persistence)
_ENV_FILE = Path(__file__).parent.parent.parent / ".env"


class ConnectionManager:
    """Manages active WebSocket connections."""

    def __init__(self) -> None:
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)
        logger.debug("Dashboard client connected. Total: %d", len(self.active))

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, data: dict) -> None:
        """Broadcast a JSON message to all connected clients."""
        payload = json.dumps(data)
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            if ws in self.active:
                self.active.remove(ws)


manager = ConnectionManager()


def create_app(pipeline=None) -> FastAPI:
    """Create and configure the FastAPI app."""
    app = FastAPI(title="J.A.R.V.I.S Dashboard", version="2.0.0")

    # Serve static files if they exist
    if STATIC_DIR.exists():
        app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    @app.get("/", response_class=HTMLResponse)
    async def index():
        """Serve the main dashboard HTML."""
        html_path = STATIC_DIR / "index.html"
        if html_path.exists():
            return html_path.read_text(encoding="utf-8")
        return HTMLResponse("<h1>J.A.R.V.I.S Dashboard loading...</h1>")

    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket):
        await manager.connect(websocket)
        try:
            while True:
                # Check message type -- text or binary
                message = await websocket.receive()

                if "text" in message:
                    # Text frame: JSON command from the UI
                    data = message["text"]
                    msg = json.loads(data)

                    if msg.get("type") == "text_input" and pipeline:
                        text = msg.get("text", "")
                        if text:
                            asyncio.create_task(
                                _process_text_input(pipeline, websocket, text)
                            )

                elif "bytes" in message:
                    # Binary frame: audio from the browser mic
                    audio_bytes = message["bytes"]
                    if pipeline and audio_bytes:
                        asyncio.create_task(
                            _process_audio_input(pipeline, websocket, audio_bytes)
                        )

        except WebSocketDisconnect:
            manager.disconnect(websocket)

    @app.get("/api/history")
    async def history():
        """Return recent conversation history from SQLite."""
        try:
            from jarvis.memory.session import SessionMemory
            mem = SessionMemory()
            await mem.init()
            turns = await mem.get_recent(limit=50)
            return {"turns": turns}
        except Exception:
            return {"turns": []}

    @app.get("/api/status")
    async def status():
        return {"status": "online", "version": "2.0.0"}

    @app.get("/api/settings")
    async def get_settings_api():
        """Return current settings (keys masked for security)."""
        from jarvis.config import get_settings
        s = get_settings()
        return {
            "provider": s.llm_provider,
            "flash_model": s.flash_model,
            "has_gemini_key": bool(s.gemini_api_key),
            "has_openai_key": bool(s.openai_api_key),
            "has_anthropic_key": bool(s.anthropic_api_key),
            "has_openrouter_key": bool(s.openrouter_api_key),
            "tts_voice": s.tts_voice,
            "tts_lang": s.tts_lang,
        }

    @app.post("/api/settings")
    async def update_settings_api(body: dict):
        """Update settings by writing to .env and reloading."""
        from dotenv import set_key
        from jarvis.config import reload_settings

        env_path = str(_ENV_FILE)

        # Map of request keys to .env variable names
        key_map = {
            "provider": "LLM_PROVIDER",
            "gemini_api_key": "GEMINI_API_KEY",
            "openai_api_key": "OPENAI_API_KEY",
            "anthropic_api_key": "ANTHROPIC_API_KEY",
            "openrouter_api_key": "OPENROUTER_API_KEY",
            "tts_voice": "TTS_VOICE",
            "tts_lang": "TTS_LANG",
        }

        for req_key, env_key in key_map.items():
            if req_key in body and body[req_key]:
                set_key(env_path, env_key, body[req_key])

        # Reload settings
        new_settings = reload_settings()
        logger.info(
            "[OK] Settings updated: provider=%s, model=%s",
            new_settings.llm_provider,
            new_settings.flash_model,
        )

        return {
            "status": "ok",
            "provider": new_settings.llm_provider,
            "flash_model": new_settings.flash_model,
        }

    return app


async def _process_text_input(pipeline, websocket: WebSocket, text: str) -> None:
    """Process text input from the dashboard and broadcast response."""
    try:
        await manager.broadcast(
            {"type": "state", "state": "THINKING", "user_text": text}
        )
        response, wav_bytes = await pipeline.process_text(text)

        # Send text response
        await manager.broadcast({
            "type": "response",
            "user_text": text,
            "response": response,
        })

        # Send TTS audio if available
        if wav_bytes:
            audio_b64 = base64.b64encode(wav_bytes).decode("ascii")
            await manager.broadcast({
                "type": "tts_audio",
                "data": audio_b64,
            })

        # Save to session memory
        try:
            from jarvis.memory.session import SessionMemory
            mem = SessionMemory()
            await mem.init()
            await mem.save_turn(text, response)
        except Exception as e:
            logger.warning("Failed to save turn to memory: %s", e)

    except Exception as e:
        logger.exception("Text processing error: %s", e)
        await manager.broadcast({"type": "error", "message": str(e)})


async def _process_audio_input(
    pipeline, websocket: WebSocket, audio_bytes: bytes
) -> None:
    """Process audio input from the browser mic."""
    try:
        await manager.broadcast({"type": "state", "state": "TRANSCRIBING"})

        user_text, response, wav_bytes = await pipeline.process_audio(audio_bytes)

        if not user_text:
            await manager.broadcast({"type": "state", "state": "IDLE"})
            return

        # Send text response
        await manager.broadcast({
            "type": "response",
            "user_text": user_text,
            "response": response,
        })

        # Send TTS audio if available
        if wav_bytes:
            audio_b64 = base64.b64encode(wav_bytes).decode("ascii")
            await manager.broadcast({
                "type": "tts_audio",
                "data": audio_b64,
            })

        # Save to session memory
        try:
            from jarvis.memory.session import SessionMemory
            mem = SessionMemory()
            await mem.init()
            await mem.save_turn(user_text, response)
        except Exception as e:
            logger.warning("Failed to save turn to memory: %s", e)

    except Exception as e:
        logger.exception("Audio processing error: %s", e)
        await manager.broadcast({"type": "error", "message": str(e)})


async def broadcast_pipeline_event(event) -> None:
    """Called by the pipeline to push state updates to dashboard clients."""
    await manager.broadcast({
        "type": "state",
        "state": event.state.name,
        **event.data,
    })
