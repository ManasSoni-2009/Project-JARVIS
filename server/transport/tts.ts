import {
  getGeminiClient,
  getSettings,
  isModelOnCooldown,
  markModelCooldown,
} from "../config.ts";

const VALID_GEMINI_VOICES = new Set([
  "Puck",
  "Charon",
  "Kore",
  "Fenrir",
  "Zephyr",
]);

function resolveGeminiVoiceName(configuredVoice: string): string {
  if (VALID_GEMINI_VOICES.has(configuredVoice)) {
    return configuredVoice;
  }
  const lower = configuredVoice.toLowerCase();
  if (lower.includes("george") || lower.includes("fenrir")) return "Fenrir";
  if (lower.includes("puck")) return "Puck";
  if (lower.includes("charon")) return "Charon";
  if (lower.includes("zephyr")) return "Zephyr";
  return "Kore";
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

export class JarvisTTS {
  public lastError: string | null = null;
  public lastProvider: "gemini-3.8-flash-lite-tts" | "browser-speech-hybrid" =
    "gemini-3.8-flash-lite-tts";

  async synthesize(
    text: string,
    opts?: { fallbackCueOnQuota?: boolean }
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

    const modelName = "gemini-3.8-flash-lite-tts";
    if (!isModelOnCooldown(modelName)) {
      const voiceName = resolveGeminiVoiceName(s.ttsVoice);
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
                prebuiltVoiceConfig: { voiceName },
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

    this.lastProvider = "browser-speech-hybrid";
    if (opts?.fallbackCueOnQuota) {
      return generateHarmonicCueWavBase64(220);
    }
    return null;
  }
}
