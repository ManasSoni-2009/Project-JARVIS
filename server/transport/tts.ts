import {
  getGeminiClient,
  getSettings,
  isModelOnCooldown,
  markModelCooldown,
} from "../config.ts";

export interface VoicePersonaProfile {
  id: string;
  label: string;
  engine: "kokoro" | "gemini";
  kokoroId: string;
  geminiVoice: "Fenrir" | "Kore" | "Puck" | "Charon" | "Zephyr";
  lang: "en-GB" | "en-US";
  speed: number;
  pitch: number;
  description: string;
  preferredBrowserVoices: string[];
}

export const VOICE_PERSONA_CATALOG: Record<string, VoicePersonaProfile> = {
  bm_george: {
    id: "bm_george",
    label: "J.A.R.V.I.S Movie Edition (bm_george · British RP)",
    engine: "kokoro",
    kokoroId: "bm_george",
    geminiVoice: "Fenrir",
    lang: "en-GB",
    speed: 1.03,
    pitch: 0.94,
    description:
      "Kokoro-82M British Male RP — Refined, composed Paul Bettany movie J.A.R.V.I.S cadence",
    preferredBrowserVoices: [
      "Microsoft Ryan Online (Natural)",
      "Google UK English Male",
      "Daniel",
      "Arthur",
      "Oliver",
      "Microsoft George",
    ],
  },
  bm_lewis: {
    id: "bm_lewis",
    label: "Lewis (bm_lewis · Deep British Baritone)",
    engine: "kokoro",
    kokoroId: "bm_lewis",
    geminiVoice: "Fenrir",
    lang: "en-GB",
    speed: 1.0,
    pitch: 0.9,
    description: "Kokoro-82M British Male — Warm, authoritative baritone",
    preferredBrowserVoices: [
      "Google UK English Male",
      "Microsoft Ryan Online (Natural)",
      "Daniel",
    ],
  },
  bm_fable: {
    id: "bm_fable",
    label: "Fable (bm_fable · Classic British RP)",
    engine: "kokoro",
    kokoroId: "bm_fable",
    geminiVoice: "Charon",
    lang: "en-GB",
    speed: 1.04,
    pitch: 0.98,
    description: "Kokoro-82M British Male — Crisp narrative diction",
    preferredBrowserVoices: [
      "Daniel",
      "Google UK English Male",
      "Arthur",
    ],
  },
  bf_emma: {
    id: "bf_emma",
    label: "F.R.I.D.A.Y. Edition (bf_emma · British Female)",
    engine: "kokoro",
    kokoroId: "bf_emma",
    geminiVoice: "Kore",
    lang: "en-GB",
    speed: 1.04,
    pitch: 1.02,
    description: "Kokoro-82M British Female — Clear, intelligent tactical cadence",
    preferredBrowserVoices: [
      "Microsoft Sonia Online (Natural)",
      "Google UK English Female",
      "Kate",
      "Serena",
    ],
  },
  bf_isabella: {
    id: "bf_isabella",
    label: "Isabella (bf_isabella · Warm British Female)",
    engine: "kokoro",
    kokoroId: "bf_isabella",
    geminiVoice: "Zephyr",
    lang: "en-GB",
    speed: 1.01,
    pitch: 1.04,
    description: "Kokoro-82M British Female — Smooth conversational studio voice",
    preferredBrowserVoices: [
      "Google UK English Female",
      "Microsoft Libby Online (Natural)",
      "Serena",
    ],
  },
  am_adam: {
    id: "am_adam",
    label: "Adam (am_adam · Deep American Studio)",
    engine: "kokoro",
    kokoroId: "am_adam",
    geminiVoice: "Fenrir",
    lang: "en-US",
    speed: 1.02,
    pitch: 0.92,
    description: "Kokoro-82M American Male — Deep, resonant studio tone",
    preferredBrowserVoices: [
      "Microsoft Christopher Online (Natural)",
      "Google US English",
      "Alex",
    ],
  },
  am_michael: {
    id: "am_michael",
    label: "Michael (am_michael · Natural American Male)",
    engine: "kokoro",
    kokoroId: "am_michael",
    geminiVoice: "Puck",
    lang: "en-US",
    speed: 1.04,
    pitch: 1.0,
    description: "Kokoro-82M American Male — Lively, natural conversational",
    preferredBrowserVoices: [
      "Microsoft Guy Online (Natural)",
      "Google US English",
      "Alex",
    ],
  },
  af_heart: {
    id: "af_heart",
    label: "Heart (af_heart · Expressive Natural Female)",
    engine: "kokoro",
    kokoroId: "af_heart",
    geminiVoice: "Kore",
    lang: "en-US",
    speed: 1.02,
    pitch: 1.03,
    description: "Kokoro-82M Flagship Female — Ultra-natural human prosody",
    preferredBrowserVoices: [
      "Microsoft Jenny Online (Natural)",
      "Microsoft Aria Online (Natural)",
      "Samantha",
    ],
  },
  af_bella: {
    id: "af_bella",
    label: "Bella (af_bella · Crisp American Female)",
    engine: "kokoro",
    kokoroId: "af_bella",
    geminiVoice: "Zephyr",
    lang: "en-US",
    speed: 1.03,
    pitch: 1.04,
    description: "Kokoro-82M American Female — Bright, articulate studio voice",
    preferredBrowserVoices: [
      "Samantha",
      "Google US English",
      "Microsoft Aria Online (Natural)",
    ],
  },
  Fenrir: {
    id: "Fenrir",
    label: "Fenrir (Gemini Baritone)",
    engine: "gemini",
    kokoroId: "bm_george",
    geminiVoice: "Fenrir",
    lang: "en-GB",
    speed: 1.02,
    pitch: 0.94,
    description: "gemini-3.8-flash-lite-tts · Deep baritone cadence",
    preferredBrowserVoices: ["Google UK English Male", "Daniel"],
  },
  Kore: {
    id: "Kore",
    label: "Kore (Gemini Studio Crisp)",
    engine: "gemini",
    kokoroId: "bf_emma",
    geminiVoice: "Kore",
    lang: "en-GB",
    speed: 1.02,
    pitch: 1.0,
    description: "gemini-3.8-flash-lite-tts · Balanced studio clarity",
    preferredBrowserVoices: ["Google UK English Male", "Daniel"],
  },
};

export function resolveVoiceProfile(configuredVoice?: string): VoicePersonaProfile {
  const key = configuredVoice || "bm_george";
  if (VOICE_PERSONA_CATALOG[key]) {
    return VOICE_PERSONA_CATALOG[key];
  }
  return VOICE_PERSONA_CATALOG.bm_george;
}

/**
 * Generates a valid 24kHz 16-bit mono RIFF WAV buffer containing a warm two-note
 * harmonic J.A.R.V.I.S acoustic acknowledgment cue when offline/rate-limited.
 */
export function generateHarmonicCueWavBase64(durationMs = 220): string {
  const sampleRate = 24000;
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const progress = i / numSamples;
    const freq = progress < 0.5 ? 528 : 660;
    const envelope = Math.sin(Math.PI * progress) * 0.22;
    const sample = Math.sin(2 * Math.PI * freq * t) * envelope;
    const int16 = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    buffer.writeInt16LE(int16, 44 + i * 2);
  }

  return buffer.toString("base64");
}

let kokoroServerOfflineUntil = 0;

export class JarvisTTS {
  public lastError: string | null = null;
  public lastProvider:
    | "kokoro-82m-onnx"
    | "gemini-3.8-flash-lite-tts"
    | "browser-british-rp-hybrid" = "kokoro-82m-onnx";

  async synthesize(
    text: string,
    opts?: { fallbackCueOnQuota?: boolean; voiceOverride?: string }
  ): Promise<string | null> {
    const s = getSettings();
    if (!s.ttsEnabled || !text.trim()) {
      return null;
    }

    const cleanText = text
      .replace(/```[\s\S]*?```/g, "code block omitted.")
      .replace(/[*_`#>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 650);

    if (!cleanText) return null;

    const profile = resolveVoiceProfile(opts?.voiceOverride || s.ttsVoice);

    // 1. Primary: Local Kokoro-82M ONNX Neural TTS Server / Python Bridge
    if (
      (s.ttsEngine === "kokoro" || profile.engine === "kokoro") &&
      Date.now() > kokoroServerOfflineUntil
    ) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1600);
        const baseUrl = (s.kokoroUrl || "http://127.0.0.1:8880").replace(/\/$/, "");
        const res = await fetch(`${baseUrl}/v1/audio/speech`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "kokoro",
            voice: profile.kokoroId,
            input: cleanText,
            response_format: "wav",
            speed: profile.speed,
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.ok) {
          const arrBuf = await res.arrayBuffer();
          if (arrBuf.byteLength > 100) {
            this.lastError = null;
            this.lastProvider = "kokoro-82m-onnx";
            return Buffer.from(arrBuf).toString("base64");
          }
        }
      } catch {
        // Back off local port 8880 check for 45 seconds if local Python bridge is not running
        kokoroServerOfflineUntil = Date.now() + 45_000;
      }
    }

    // 2. Secondary: Cloud Neural TTS (gemini-3.8-flash-lite-tts mapped to British/Studio persona)
    if (s.ttsEngine !== "browser_british") {
      const modelName = "gemini-3.8-flash-lite-tts";
      if (!isModelOnCooldown(modelName)) {
        try {
          const ai = getGeminiClient();
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                role: "user",
                parts: [{ text: cleanText }],
              },
            ],
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: profile.geminiVoice },
                },
              },
            },
          });

          const parts = response.candidates?.[0]?.content?.parts ?? [];
          for (const part of parts) {
            if (part.inlineData?.data) {
              this.lastError = null;
              this.lastProvider = "gemini-3.8-flash-lite-tts";
              return part.inlineData.data;
            }
          }
        } catch (err) {
          markModelCooldown(modelName, err);
          this.lastError = err instanceof Error ? err.message : String(err);
        }
      }
    }

    // 3. Tertiary: Browser British RP Cinema Hybrid + Harmonic WAV Cue
    this.lastProvider = "browser-british-rp-hybrid";
    if (opts?.fallbackCueOnQuota) {
      return generateHarmonicCueWavBase64(220);
    }
    return null;
  }
}
