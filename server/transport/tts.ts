import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
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
  edgeVoice: string;
  edgePitch: string;
  edgeRate: number;
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
    label: "J.A.R.V.I.S Movie Edition (bm_george · British RP Neural)",
    engine: "kokoro",
    kokoroId: "bm_george",
    edgeVoice: "en-GB-RyanNeural",
    edgePitch: "-12Hz",
    edgeRate: 1.02,
    geminiVoice: "Charon",
    lang: "en-GB",
    speed: 1.02,
    pitch: 0.94,
    description:
      "Neural British RP Baritone (RyanNeural + Kokoro bm_george) — Calm, articulate Paul Bettany movie J.A.R.V.I.S cadence",
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
    label: "Oxford Gentleman (bm_lewis · Warm British Baritone)",
    engine: "kokoro",
    kokoroId: "bm_lewis",
    edgeVoice: "en-GB-ThomasNeural",
    edgePitch: "-10Hz",
    edgeRate: 1.0,
    geminiVoice: "Fenrir",
    lang: "en-GB",
    speed: 1.0,
    pitch: 0.9,
    description:
      "Neural British Male (ThomasNeural + Kokoro bm_lewis) — Warm, authoritative Oxford cadence",
    preferredBrowserVoices: [
      "Microsoft Thomas Online (Natural)",
      "Google UK English Male",
      "Microsoft Ryan Online (Natural)",
      "Daniel",
    ],
  },
  bm_fable: {
    id: "bm_fable",
    label: "Fable (bm_fable · Crisp British Tactician)",
    engine: "kokoro",
    kokoroId: "bm_fable",
    edgeVoice: "en-GB-RyanNeural",
    edgePitch: "+0Hz",
    edgeRate: 1.06,
    geminiVoice: "Charon",
    lang: "en-GB",
    speed: 1.05,
    pitch: 0.98,
    description:
      "Neural British Male (RyanNeural Crisp + Kokoro bm_fable) — Responsive tactical diction",
    preferredBrowserVoices: [
      "Daniel",
      "Google UK English Male",
      "Arthur",
    ],
  },
  bf_emma: {
    id: "bf_emma",
    label: "F.R.I.D.A.Y. Edition (bf_emma · British Tactical Female)",
    engine: "kokoro",
    kokoroId: "bf_emma",
    edgeVoice: "en-GB-SoniaNeural",
    edgePitch: "+0Hz",
    edgeRate: 1.03,
    geminiVoice: "Kore",
    lang: "en-GB",
    speed: 1.03,
    pitch: 1.02,
    description:
      "Neural British Female (SoniaNeural + Kokoro bf_emma) — Clear, intelligent F.R.I.D.A.Y. cadence",
    preferredBrowserVoices: [
      "Microsoft Sonia Online (Natural)",
      "Google UK English Female",
      "Kate",
      "Serena",
    ],
  },
  bf_isabella: {
    id: "bf_isabella",
    label: "Isabella (bf_isabella · Warm British Studio)",
    engine: "kokoro",
    kokoroId: "bf_isabella",
    edgeVoice: "en-GB-LibbyNeural",
    edgePitch: "+0Hz",
    edgeRate: 1.02,
    geminiVoice: "Zephyr",
    lang: "en-GB",
    speed: 1.01,
    pitch: 1.04,
    description:
      "Neural British Female (LibbyNeural + Kokoro bf_isabella) — Smooth conversational studio voice",
    preferredBrowserVoices: [
      "Google UK English Female",
      "Microsoft Libby Online (Natural)",
      "Serena",
    ],
  },
  am_adam: {
    id: "am_adam",
    label: "Brian Multilingual (am_adam · Deep Natural Studio)",
    engine: "kokoro",
    kokoroId: "am_adam",
    edgeVoice: "en-US-BrianMultilingualNeural",
    edgePitch: "-8Hz",
    edgeRate: 1.01,
    geminiVoice: "Fenrir",
    lang: "en-US",
    speed: 1.01,
    pitch: 0.93,
    description:
      "Multilingual Neural Studio Male (BrianNeural + Kokoro am_adam) — Deep, rich conversational voice",
    preferredBrowserVoices: [
      "Microsoft Brian Online (Natural)",
      "Microsoft Christopher Online (Natural)",
      "Google US English",
      "Alex",
    ],
  },
  am_michael: {
    id: "am_michael",
    label: "Andrew Multilingual (am_michael · Lifelike Natural Male)",
    engine: "kokoro",
    kokoroId: "am_michael",
    edgeVoice: "en-US-AndrewMultilingualNeural",
    edgePitch: "-2Hz",
    edgeRate: 1.03,
    geminiVoice: "Puck",
    lang: "en-US",
    speed: 1.03,
    pitch: 1.0,
    description:
      "Multilingual Neural Male (AndrewNeural + Kokoro am_michael) — Expressive, natural human prosody",
    preferredBrowserVoices: [
      "Microsoft Andrew Online (Natural)",
      "Microsoft Guy Online (Natural)",
      "Google US English",
      "Alex",
    ],
  },
  af_heart: {
    id: "af_heart",
    label: "Ava Multilingual (af_heart · Expressive Flagship)",
    engine: "kokoro",
    kokoroId: "af_heart",
    edgeVoice: "en-US-AvaMultilingualNeural",
    edgePitch: "+0Hz",
    edgeRate: 1.02,
    geminiVoice: "Kore",
    lang: "en-US",
    speed: 1.02,
    pitch: 1.02,
    description:
      "Multilingual Flagship Female (AvaNeural + Kokoro af_heart) — Ultra-natural human warmth",
    preferredBrowserVoices: [
      "Microsoft Ava Online (Natural)",
      "Microsoft Jenny Online (Natural)",
      "Samantha",
    ],
  },
  af_bella: {
    id: "af_bella",
    label: "Emma Multilingual (af_bella · Warm Natural Female)",
    engine: "kokoro",
    kokoroId: "af_bella",
    edgeVoice: "en-US-EmmaMultilingualNeural",
    edgePitch: "+0Hz",
    edgeRate: 1.02,
    geminiVoice: "Zephyr",
    lang: "en-US",
    speed: 1.02,
    pitch: 1.03,
    description:
      "Multilingual Neural Female (EmmaNeural + Kokoro af_bella) — Clear, bright studio companion",
    preferredBrowserVoices: [
      "Microsoft Emma Online (Natural)",
      "Samantha",
      "Google US English",
    ],
  },
  Fenrir: {
    id: "Fenrir",
    label: "Fenrir (Neural Baritone)",
    engine: "gemini",
    kokoroId: "bm_george",
    edgeVoice: "en-GB-RyanNeural",
    edgePitch: "-14Hz",
    edgeRate: 1.01,
    geminiVoice: "Fenrir",
    lang: "en-GB",
    speed: 1.01,
    pitch: 0.94,
    description: "Deep British baritone cadence (Neural 24kHz)",
    preferredBrowserVoices: ["Google UK English Male", "Daniel"],
  },
  Kore: {
    id: "Kore",
    label: "Kore (Neural Studio Crisp)",
    engine: "gemini",
    kokoroId: "bf_emma",
    edgeVoice: "en-US-AndrewMultilingualNeural",
    edgePitch: "+0Hz",
    edgeRate: 1.02,
    geminiVoice: "Kore",
    lang: "en-GB",
    speed: 1.02,
    pitch: 1.0,
    description: "Balanced studio clarity (Neural 24kHz)",
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

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapPcm16ToWavBase64(pcmBase64: string, sampleRate = 24000): string {
  const pcmBuf = Buffer.from(pcmBase64, "base64");
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmBuf.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmBuf.length, 40);
  return Buffer.concat([header, pcmBuf]).toString("base64");
}

let kokoroServerOfflineUntil = 0;

export class JarvisTTS {
  public lastError: string | null = null;
  public lastProvider:
    | "kokoro-82m-onnx"
    | "edge-neural-ryan-rp"
    | "gemini-2.5-flash-tts"
    | "browser-british-rp-hybrid" = "edge-neural-ryan-rp";

  private async synthesizeEdgeNeural(
    text: string,
    profile: VoicePersonaProfile
  ): Promise<string | null> {
    const tts = new MsEdgeTTS({
      connectionTimeoutMs: 5000,
      synthesisTimeoutMs: 12000,
    });
    try {
      await tts.setMetadata(
        profile.edgeVoice,
        OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
      );
      const safeInput = escapeXml(text);
      const { audioStream } = tts.toStream(safeInput, {
        rate: profile.edgeRate,
        pitch: profile.edgePitch,
      });

      const buf = await new Promise<Buffer | null>((resolve) => {
        const chunks: Buffer[] = [];
        const timeout = setTimeout(() => {
          resolve(chunks.length > 0 ? Buffer.concat(chunks) : null);
        }, 7000);

        audioStream.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });
        audioStream.on("close", () => {
          clearTimeout(timeout);
          resolve(chunks.length > 0 ? Buffer.concat(chunks) : null);
        });
        audioStream.on("end", () => {
          clearTimeout(timeout);
          resolve(chunks.length > 0 ? Buffer.concat(chunks) : null);
        });
        audioStream.on("error", () => {
          clearTimeout(timeout);
          resolve(null);
        });
      });

      if (buf && buf.length > 128) {
        return buf.toString("base64");
      }
      return null;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      return null;
    } finally {
      try {
        tts.close();
      } catch {
        // ignore socket cleanup error
      }
    }
  }

  async synthesize(
    text: string,
    opts?: { voiceOverride?: string }
  ): Promise<string | null> {
    const s = getSettings();
    if (!s.ttsEnabled || !text.trim()) {
      return null;
    }

    const cleanText = text
      .replace(/```[\s\S]*?```/g, "code block ready.")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[*_`#>•]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 750);

    if (!cleanText) return null;

    const profile = resolveVoiceProfile(opts?.voiceOverride || s.ttsVoice);

    // 1. Primary Local Hardware Engine: Kokoro-82M ONNX Bridge (port 8880)
    if (
      s.ttsEngine === "kokoro" &&
      Date.now() > kokoroServerOfflineUntil
    ) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1400);
        const baseUrl = (s.kokoroUrl || "http://127.0.0.1:8880").replace(
          /\/v1\/audio\/speech\/?$/,
          ""
        ).replace(/\/$/, "");
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
          if (arrBuf.byteLength > 200) {
            this.lastError = null;
            this.lastProvider = "kokoro-82m-onnx";
            return Buffer.from(arrBuf).toString("base64");
          }
        }
      } catch {
        kokoroServerOfflineUntil = Date.now() + 45_000;
      }
    }

    // 2. Built-In Zero-Config Neural British Studio TTS (en-GB-RyanNeural / Multilingual Neural)
    if (s.ttsEngine !== "browser_british" && s.ttsEngine !== "gemini") {
      const edgeAudio = await this.synthesizeEdgeNeural(cleanText, profile);
      if (edgeAudio) {
        this.lastError = null;
        this.lastProvider = "edge-neural-ryan-rp";
        return edgeAudio;
      }
    }

    // 3. Cloud Gemini 2.5 Flash Neural TTS (with proper PCM -> RIFF WAV wrapper)
    if (s.ttsEngine !== "browser_british" && process.env.GEMINI_API_KEY) {
      const modelName = "gemini-2.5-flash-preview-tts";
      if (!isModelOnCooldown(modelName)) {
        try {
          const ai = getGeminiClient();
          const styledPrompt =
            profile.lang === "en-GB"
              ? `Speak naturally in a calm, refined, witty British AI butler voice like J.A.R.V.I.S.: ${cleanText}`
              : cleanText;
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: styledPrompt }] }],
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
              const mime = part.inlineData.mimeType || "";
              const audioData =
                mime.includes("L16") || mime.includes("pcm")
                  ? wrapPcm16ToWavBase64(part.inlineData.data, 24000)
                  : part.inlineData.data;
              this.lastError = null;
              this.lastProvider = "gemini-2.5-flash-tts";
              return audioData;
            }
          }
        } catch (err) {
          markModelCooldown(modelName, err);
          this.lastError = err instanceof Error ? err.message : String(err);
        }
      }
    }

    // Fallback to Edge Neural even if ttsEngine was set to "gemini" and Gemini failed
    if (s.ttsEngine === "gemini") {
      const edgeAudio = await this.synthesizeEdgeNeural(cleanText, profile);
      if (edgeAudio) {
        this.lastError = null;
        this.lastProvider = "edge-neural-ryan-rp";
        return edgeAudio;
      }
    }

    // 4. Clean null so client speaks via browser en-GB fallback without any cut-off beep
    this.lastProvider = "browser-british-rp-hybrid";
    return null;
  }
}
