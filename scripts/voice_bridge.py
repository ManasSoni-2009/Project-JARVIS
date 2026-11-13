#!/usr/bin/env python3
"""
J.A.R.V.I.S v3.0 — Local Kokoro-82M ONNX TTS & Faster-Whisper STT Bridge
Listens on http://127.0.0.1:8880 and exposes:
  - GET  /health
  - POST /v1/audio/speech         (Kokoro-82M ONNX: bm_george, bm_lewis, bf_emma, am_adam, af_heart, etc.)
  - POST /v1/audio/transcriptions (Faster-Whisper: base.en INT8)

Install optional local Python dependencies:
  pip install kokoro-onnx faster-whisper soundfile numpy
"""
import base64
import io
import json
import os
import tempfile
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = int(os.environ.get("JARVIS_VOICE_PORT", "8880"))

kokoro_engine = None
whisper_engine = None

try:
    from kokoro_onnx import Kokoro
    import soundfile as sf
    if os.path.exists("kokoro-v1.0.onnx") and os.path.exists("voices-v1.0.bin"):
        kokoro_engine = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")
        print("[JARVIS-VOICE] Kokoro-82M ONNX loaded (default voice: bm_george)")
except Exception as e:
    print(f"[JARVIS-VOICE] Kokoro-82M ONNX optional bridge not loaded: {e}")

try:
    from faster_whisper import WhisperModel
    whisper_engine = WhisperModel("base.en", device="cpu", compute_type="int8")
    print("[JARVIS-VOICE] Faster-Whisper (base.en INT8) loaded")
except Exception as e:
    print(f"[JARVIS-VOICE] Faster-Whisper optional bridge not loaded: {e}")


class VoiceBridgeHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(
                json.dumps(
                    {
                        "ok": True,
                        "kokoro_loaded": kokoro_engine is not None,
                        "faster_whisper_loaded": whisper_engine is not None,
                        "default_voice": "bm_george",
                    }
                ).encode("utf-8")
            )
            return
        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length) if length > 0 else b"{}"
        try:
            payload = json.loads(body.decode("utf-8"))
        except Exception:
            payload = {}

        if self.path == "/v1/audio/speech":
            if kokoro_engine is None:
                self.send_response(503)
                self.end_headers()
                return
            text = payload.get("input", "")
            voice = payload.get("voice", "bm_george")
            speed = float(payload.get("speed", 1.03))
            lang = "en-gb" if voice.startswith("b") else "en-us"
            samples, sample_rate = kokoro_engine.create(
                text, voice=voice, speed=speed, lang=lang
            )
            buf = io.BytesIO()
            sf.write(buf, samples, sample_rate, format="WAV")
            wav_bytes = buf.getvalue()
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(wav_bytes)))
            self.end_headers()
            self.wfile.write(wav_bytes)
            return

        if self.path == "/v1/audio/transcriptions":
            if whisper_engine is None:
                self.send_response(503)
                self.end_headers()
                return
            audio_b64 = payload.get("audio_base64", "")
            raw_bytes = base64.b64decode(audio_b64)
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
                tmp.write(raw_bytes)
                tmp_path = tmp.name
            try:
                segments, _ = whisper_engine.transcribe(tmp_path, beam_size=3)
                transcript = " ".join(seg.text.strip() for seg in segments).strip()
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
            resp = json.dumps({"text": transcript}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(resp)
            return

        self.send_response(404)
        self.end_headers()


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", PORT), VoiceBridgeHandler)
    print(f"[JARVIS-VOICE] Bridge listening on http://127.0.0.1:{PORT}")
    server.serve_forever()
