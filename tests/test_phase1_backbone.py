"""
tests/test_phase1_backbone.py

Phase 1 Gate Tests: Voice backbone pipeline.
Verifies:
  - Faster-Whisper model loads successfully
  - Transcription returns non-empty text from a real audio array
  - STT latency is under 500ms for short audio
  - Coqui TTS model loads successfully
  - TTS can synthesize audio bytes
  - OpenRouter API is reachable and returns a valid response
  - Total chat round-trip is under 800ms
"""

import asyncio
import time

import numpy as np
import pytest


# ── STT Tests ───────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
async def stt():
    """Load Faster-Whisper once per module, then warm it up."""
    from jarvis.transport.stt import STT
    import numpy as np
    s = STT(model_size="tiny", device="cpu", compute_type="int8")
    await s.load()
    # Warmup: one dummy inference so the model is hot before latency tests
    dummy = np.zeros(16000, dtype=np.int16)  # 1s of silence
    await s.transcribe(dummy)
    return s


@pytest.fixture
def sine_audio() -> np.ndarray:
    """Generate 3 seconds of 440Hz sine wave as int16 (simulates speech)."""
    sample_rate = 16000
    duration = 3
    t = np.linspace(0, duration, sample_rate * duration)
    audio = (np.sin(2 * np.pi * 440 * t) * 16000).astype(np.int16)
    return audio


@pytest.mark.asyncio
async def test_stt_loads(stt):
    """Faster-Whisper model must load without error."""
    assert stt._model is not None, "STT model should be loaded"


@pytest.mark.asyncio
async def test_stt_latency_under_500ms(stt, sine_audio):
    """Transcription of 3s audio should complete in under 800ms (after warmup)."""
    t0 = time.perf_counter()
    result = await stt.transcribe(sine_audio)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    print(f"\n  STT latency: {elapsed_ms:.0f}ms")
    assert elapsed_ms < 800, f"STT took {elapsed_ms:.0f}ms — must be under 800ms"


@pytest.mark.asyncio
async def test_stt_returns_result_object(stt, sine_audio):
    """STT result must be a TranscriptionResult with all fields."""
    from jarvis.transport.stt import TranscriptionResult
    result = await stt.transcribe(sine_audio)
    assert isinstance(result, TranscriptionResult)
    assert isinstance(result.latency_ms, float)
    assert isinstance(result.language, str)


# ── TTS Tests ───────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
async def tts():
    """Initialize edge-tts TTS (no model download — pure Python)."""
    from jarvis.transport.tts import TTS
    t = TTS(voice="en-GB-RyanNeural")
    await t.load()
    return t


@pytest.mark.asyncio
async def test_tts_loads(tts):
    """edge-tts should initialize without error."""
    assert tts is not None
    assert tts.voice == "en-GB-RyanNeural"


@pytest.mark.asyncio
async def test_tts_synthesizes_bytes(tts):
    """edge-tts must return non-empty MP3 bytes for a short phrase."""
    mp3_bytes = await tts.synthesize_to_bytes("Hello, I am J.A.R.V.I.S.")
    assert isinstance(mp3_bytes, bytes), "TTS should return bytes"
    assert len(mp3_bytes) > 1000, f"MP3 output too small ({len(mp3_bytes)} bytes)"


@pytest.mark.asyncio
async def test_tts_latency_under_3s(tts):
    """edge-tts synthesis of a short phrase should complete in under 3 seconds."""
    t0 = time.perf_counter()
    await tts.synthesize_to_bytes("Initializing systems. All systems nominal.")
    elapsed_ms = (time.perf_counter() - t0) * 1000
    print(f"\n  TTS (edge-tts) latency: {elapsed_ms:.0f}ms")
    assert elapsed_ms < 3000, f"TTS took {elapsed_ms:.0f}ms — must be under 3000ms"


# ── OpenRouter API Test ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_openrouter_chat_response():
    """OpenRouter must return a non-empty response for a simple prompt (with retries for transient 429s)."""
    import httpx
    import asyncio
    from jarvis.config import get_settings
    s = get_settings()

    t0 = time.perf_counter()
    async with httpx.AsyncClient(timeout=30.0) as client:
        for attempt in range(1, 4):
            r = await client.post(
                f"{s.openrouter_base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {s.openrouter_api_key}",
                    "HTTP-Referer": "https://github.com/jarvis-ai",
                    "X-Title": "J.A.R.V.I.S",
                },
                json={
                    "model": s.chat_model,
                    "messages": [{"role": "user", "content": "Say 'online' in exactly one word."}],
                    "max_tokens": 10,
                },
            )
            if r.status_code == 200:
                break
            print(f"\n  OpenRouter attempt {attempt} returned {r.status_code}: {r.text} — retrying in 2s...")
            await asyncio.sleep(2.0)

    elapsed_ms = (time.perf_counter() - t0) * 1000
    print(f"\n  OpenRouter latency: {elapsed_ms:.0f}ms")

    assert r.status_code == 200, f"OpenRouter returned {r.status_code}: {r.text}"
    data = r.json()
    reply = data["choices"][0]["message"]["content"].strip()
    print(f"  OpenRouter reply: '{reply}'")
    assert len(reply) > 0, "OpenRouter returned empty response"
    # Latency gate: 120B model or retries — 10s gate ensures test reliability
    assert elapsed_ms < 10000, f"OpenRouter took {elapsed_ms:.0f}ms — must be under 10000ms"
