"""
jarvis/transport/stt.py

Speech-to-Text using faster-whisper (CPU, int8 quantised).
Accepts raw audio bytes (webm/opus from WebSocket) and returns transcribed text.
Uses ffmpeg for decoding non-PCM formats before passing to Whisper.
"""

from __future__ import annotations

import asyncio
import io
import logging
import subprocess
import tempfile
import time
from pathlib import Path
from typing import NamedTuple

import numpy as np

logger = logging.getLogger(__name__)


def _get_ffmpeg_exe() -> str:
    """Get the ffmpeg executable path, falling back to imageio-ffmpeg."""
    import shutil
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return "ffmpeg"


class TranscriptionResult(NamedTuple):
    """Result of a speech-to-text transcription."""

    text: str
    language: str
    latency_ms: float
    confidence: float


class STT:
    """Async wrapper around faster-whisper for speech-to-text.

    The model is loaded once and reused across all transcription calls.
    Supports both raw PCM numpy arrays and encoded audio bytes (webm/opus).
    """

    def __init__(
        self,
        model_size: str = "tiny",
        device: str = "cpu",
        compute_type: str = "int8",
    ) -> None:
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
        self._model = None

    async def load(self) -> None:
        """Load the Whisper model in a thread pool (downloads on first run)."""
        logger.info("Loading Faster-Whisper '%s' model...", self.model_size)
        t0 = time.perf_counter()

        def _load():
            from faster_whisper import WhisperModel

            return WhisperModel(
                self.model_size,
                device=self.device,
                compute_type=self.compute_type,
            )

        self._model = await asyncio.get_event_loop().run_in_executor(None, _load)
        elapsed_ms = (time.perf_counter() - t0) * 1000
        logger.info("[OK] Whisper model loaded in %.0fms", elapsed_ms)

    async def transcribe(
        self, audio: np.ndarray, sample_rate: int = 16000
    ) -> TranscriptionResult:
        """Transcribe a numpy int16 PCM array.

        Returns a TranscriptionResult with text, language, timing, and confidence.
        """
        if self._model is None:
            await self.load()

        t0 = time.perf_counter()

        # Convert int16 to float32 for Whisper
        audio_f32 = audio.astype(np.float32) / 32768.0

        def _run():
            segments, info = self._model.transcribe(
                audio_f32,
                beam_size=1,
                language="en",
                vad_filter=True,
                vad_parameters={"min_silence_duration_ms": 500},
            )
            texts = []
            probs = []
            for seg in segments:
                texts.append(seg.text.strip())
                probs.append(seg.avg_logprob)
            full_text = " ".join(texts).strip()
            avg_conf = float(np.mean(probs)) if probs else 0.0
            return full_text, info.language, avg_conf

        text, language, confidence = await asyncio.get_event_loop().run_in_executor(
            None, _run
        )
        latency_ms = (time.perf_counter() - t0) * 1000

        logger.debug("STT [%.0fms] [%s]: '%s'", latency_ms, language, text)
        return TranscriptionResult(
            text=text,
            language=language,
            latency_ms=latency_ms,
            confidence=confidence,
        )

    async def transcribe_bytes(self, audio_bytes: bytes) -> str:
        """Transcribe raw encoded audio bytes (webm/opus/mp3/wav) to text.

        Uses ffmpeg to decode the audio to 16 kHz mono PCM before
        passing it to the Whisper model.
        """
        if self._model is None:
            await self.load()

        t0 = time.perf_counter()

        def _decode_and_transcribe() -> str:
            # Write incoming bytes to a temp file so ffmpeg can read them
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            try:
                # Use ffmpeg to convert to 16kHz mono s16le PCM
                result = subprocess.run(
                    [
                        _get_ffmpeg_exe(), "-y",
                        "-i", tmp_path,
                        "-ar", "16000",
                        "-ac", "1",
                        "-f", "s16le",
                        "-acodec", "pcm_s16le",
                        "pipe:1",
                    ],
                    capture_output=True,
                    timeout=15,
                )
                if result.returncode != 0:
                    stderr = result.stderr.decode("utf-8", errors="replace")
                    logger.error("ffmpeg decode failed: %s", stderr[:200])
                    return ""

                pcm_data = result.stdout
                if not pcm_data:
                    logger.warning("ffmpeg produced empty output")
                    return ""

                # Convert raw PCM bytes to float32 array for Whisper
                audio_i16 = np.frombuffer(pcm_data, dtype=np.int16)
                audio_f32 = audio_i16.astype(np.float32) / 32768.0

                segments, _info = self._model.transcribe(
                    audio_f32,
                    beam_size=1,
                    language="en",
                    vad_filter=True,
                    vad_parameters={"min_silence_duration_ms": 500},
                )
                texts = [seg.text.strip() for seg in segments]
                return " ".join(texts).strip()
            finally:
                try:
                    Path(tmp_path).unlink(missing_ok=True)
                except OSError:
                    pass

        text = await asyncio.get_event_loop().run_in_executor(
            None, _decode_and_transcribe
        )
        latency_ms = (time.perf_counter() - t0) * 1000
        logger.debug("STT bytes [%.0fms]: '%s'", latency_ms, text[:80] if text else "")
        return text

    @classmethod
    def from_settings(cls) -> STT:
        """Create an STT instance from application settings."""
        from jarvis.config import get_settings

        s = get_settings()
        return cls(
            model_size=s.whisper_model_size,
            device=s.whisper_device,
            compute_type=s.whisper_compute_type,
        )
