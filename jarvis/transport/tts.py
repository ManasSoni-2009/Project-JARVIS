"""
jarvis/transport/tts.py

Text-to-Speech using Kokoro TTS -- a fast, high-quality, local neural TTS.
Produces 24 kHz 16-bit PCM WAV audio suitable for WebSocket streaming.

No internet connection required after initial model download.
"""

from __future__ import annotations

import asyncio
import io
import logging
import time
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# Mapping from language short codes to Kokoro lang_code
_LANG_MAP: dict[str, str] = {
    "en": "a",       # American English
    "en-us": "a",
    "en-gb": "b",    # British English
    "hi": "h",       # Hindi
    "ja": "j",       # Japanese
    "zh": "z",       # Chinese
    "ko": "k",       # Korean
    "fr": "f",       # French
    "es": "e",       # Spanish (Latin American)
}

SAMPLE_RATE = 24000


class KokoroTTS:
    """Async Kokoro TTS wrapper.

    Synthesizes text to WAV bytes (16-bit PCM, 24 kHz mono) that can be
    sent directly over a WebSocket to the browser dashboard.
    """

    def __init__(
        self,
        voice: str = "af_heart",
        lang_code: str = "a",
    ) -> None:
        self.voice = voice
        self.lang_code = lang_code
        self._pipeline = None

    async def load(self) -> None:
        """Load the Kokoro pipeline in a thread pool (heavy first-run download)."""
        t0 = time.perf_counter()
        logger.info("Loading Kokoro TTS (voice=%s, lang=%s)...", self.voice, self.lang_code)

        def _load():
            from kokoro import KPipeline
            return KPipeline(lang_code=self.lang_code)

        self._pipeline = await asyncio.get_event_loop().run_in_executor(None, _load)
        elapsed_ms = (time.perf_counter() - t0) * 1000
        logger.info("[OK] Kokoro TTS loaded in %.0fms", elapsed_ms)

    async def synthesize(self, text: str) -> bytes:
        """Synthesize text into WAV bytes (16-bit PCM, 24 kHz mono).

        Returns raw WAV file bytes including the WAV header.
        """
        if not text.strip():
            return b""

        if self._pipeline is None:
            raise RuntimeError("Kokoro TTS not loaded. Call load() first.")

        t0 = time.perf_counter()
        logger.debug("TTS synthesizing: '%s'", text[:60])

        def _generate() -> bytes:
            import soundfile as sf

            # Kokoro yields (graphemes, phonemes, audio_chunk) tuples
            audio_chunks: list[np.ndarray] = []
            for _gs, _ps, audio in self._pipeline(text, voice=self.voice):
                if audio is not None:
                    audio_chunks.append(audio)

            if not audio_chunks:
                raise RuntimeError("Kokoro returned no audio")

            # Concatenate all chunks into one array
            full_audio = np.concatenate(audio_chunks)

            # Convert float32 [-1, 1] to int16
            pcm_int16 = (full_audio * 32767).clip(-32768, 32767).astype(np.int16)

            # Write to WAV bytes
            buf = io.BytesIO()
            sf.write(buf, pcm_int16, SAMPLE_RATE, format="WAV", subtype="PCM_16")
            return buf.getvalue()

        wav_bytes = await asyncio.get_event_loop().run_in_executor(None, _generate)
        elapsed_ms = (time.perf_counter() - t0) * 1000
        logger.debug("TTS synthesis complete: %.0fms, %d bytes", elapsed_ms, len(wav_bytes))
        return wav_bytes

    def set_language(self, lang: str) -> None:
        """Switch the language code. Requires re-loading the pipeline."""
        new_code = _LANG_MAP.get(lang.lower(), "a")
        if new_code != self.lang_code:
            self.lang_code = new_code
            self._pipeline = None  # Force reload on next synthesize
            logger.info("TTS language changed to '%s' (code=%s)", lang, new_code)

    @classmethod
    def from_settings(cls) -> KokoroTTS:
        """Create a KokoroTTS instance from application settings."""
        from jarvis.config import get_settings

        s = get_settings()
        lang_code = _LANG_MAP.get(s.tts_lang.lower(), "a")
        return cls(voice=s.tts_voice, lang_code=lang_code)
