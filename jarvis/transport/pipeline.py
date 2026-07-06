"""
jarvis/transport/pipeline.py

Request/response pipeline that wires together: STT -> Supervisor -> TTS.

Unlike the old pipecat_pipeline.py, this has NO background audio loop,
NO wake word detection, and NO microphone capture. Everything is driven
by explicit calls from the WebSocket server or other transports.

The pipeline exposes two main methods:
  - process_text(text) -> (response_text, wav_bytes | None)
  - process_audio(audio_bytes) -> (user_text, response_text, wav_bytes | None)
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Callable, Coroutine, Optional, Tuple

logger = logging.getLogger(__name__)


class PipelineState(Enum):
    """States the pipeline can be in, broadcast to connected clients."""

    IDLE = auto()
    LISTENING = auto()
    TRANSCRIBING = auto()
    THINKING = auto()
    SPEAKING = auto()
    ERROR = auto()


@dataclass
class PipelineEvent:
    """Event broadcast to all WebSocket listeners (dashboard)."""

    state: PipelineState
    data: dict = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)


StateCallback = Callable[[PipelineEvent], Coroutine]


class JarvisPipeline:
    """Request/response pipeline for J.A.R.V.I.S.

    No background loop -- everything is triggered by explicit method calls
    from the WebSocket server or other transport layers.
    """

    def __init__(
        self,
        stt=None,
        tts=None,
        on_event: Optional[StateCallback] = None,
    ) -> None:
        self.stt = stt
        self.tts = tts
        self.on_event = on_event
        self._processor: Optional[Callable[[str], Coroutine]] = None

    def set_processor(self, fn: Callable[[str], Coroutine]) -> None:
        """Plug in the LangGraph supervisor (or any async text -> text function)."""
        self._processor = fn

    async def process_text(self, text: str) -> Tuple[str, Optional[bytes]]:
        """Process a text input through the supervisor and TTS.

        Args:
            text: The user's text input.

        Returns:
            Tuple of (response_text, wav_bytes or None).
        """
        if self._processor is None:
            raise RuntimeError("No processor set. Call set_processor() first.")

        t0 = time.perf_counter()

        # Run through the supervisor
        await self._emit(PipelineState.THINKING, {"user_text": text})
        response = await self._run_processor(text)

        # Generate TTS audio
        wav_bytes = None
        if self.tts is not None and response:
            await self._emit(PipelineState.SPEAKING, {"response": response})
            try:
                wav_bytes = await self.tts.synthesize(response)
            except Exception as exc:
                logger.error("TTS synthesis failed: %s", exc)

        total_ms = (time.perf_counter() - t0) * 1000
        logger.info(
            "Pipeline text [%.0fms]: '%s' -> '%s'",
            total_ms,
            text[:40],
            response[:40] if response else "",
        )

        await self._emit(PipelineState.IDLE, {
            "last_user": text,
            "last_response": response,
            "round_trip_ms": round(total_ms),
        })

        return response, wav_bytes

    async def process_audio(
        self, audio_bytes: bytes
    ) -> Tuple[str, str, Optional[bytes]]:
        """Process raw audio bytes through STT -> Supervisor -> TTS.

        Args:
            audio_bytes: Encoded audio (webm/opus) from the browser.

        Returns:
            Tuple of (user_text, response_text, wav_bytes or None).
        """
        if self._processor is None:
            raise RuntimeError("No processor set. Call set_processor() first.")

        if self.stt is None:
            raise RuntimeError("No STT engine configured.")

        t0 = time.perf_counter()

        # 1. Transcribe
        await self._emit(PipelineState.TRANSCRIBING, {})
        user_text = await self.stt.transcribe_bytes(audio_bytes)

        if not user_text:
            logger.debug("Empty transcription -- ignoring")
            await self._emit(PipelineState.IDLE, {})
            return "", "", None

        logger.info("STT result: '%s'", user_text)

        # 2. Process through supervisor
        await self._emit(PipelineState.THINKING, {"user_text": user_text})
        response = await self._run_processor(user_text)

        # 3. Generate TTS audio
        wav_bytes = None
        if self.tts is not None and response:
            await self._emit(PipelineState.SPEAKING, {"response": response})
            try:
                wav_bytes = await self.tts.synthesize(response)
            except Exception as exc:
                logger.error("TTS synthesis failed: %s", exc)

        total_ms = (time.perf_counter() - t0) * 1000
        logger.info(
            "Pipeline audio [%.0fms]: '%s' -> '%s'",
            total_ms,
            user_text[:40],
            response[:40] if response else "",
        )

        await self._emit(PipelineState.IDLE, {
            "last_user": user_text,
            "last_response": response,
            "round_trip_ms": round(total_ms),
        })

        return user_text, response, wav_bytes

    # -- Private helpers ---------------------------------------------------

    async def _run_processor(self, text: str) -> str:
        """Run the processor with error handling."""
        try:
            return await self._processor(text)
        except Exception as exc:
            logger.exception("Processor error: %s", exc)
            await self._emit(PipelineState.ERROR, {"error": str(exc)})
            return "I encountered an error processing that request. Please try again."

    async def _emit(self, state: PipelineState, data: dict) -> None:
        """Emit a pipeline event to the registered callback."""
        if self.on_event:
            event = PipelineEvent(state=state, data=data)
            try:
                await self.on_event(event)
            except Exception as exc:
                logger.warning("Event callback error: %s", exc)
