import {
  getGeminiClient,
  getSettings,
  isModelOnCooldown,
  markModelCooldown,
} from "../config.ts";

let whisperBridgeOfflineUntil = 0;

export class STT {
  public lastProvider:
    | "faster-whisper-local"
    | "openai-whisper"
    | "gemini-3.5-transcribe" = "faster-whisper-local";

  async transcribeBytes(
    audioBuffer: Buffer,
    mimeType = "audio/webm"
  ): Promise<string> {
    if (!audioBuffer || audioBuffer.length === 0) {
      return "";
    }

    const s = getSettings();
    const normalizedMime = mimeType.split(";")[0].trim() || "audio/webm";

    // 1. Primary: Local Faster-Whisper Server / Python Bridge (http://127.0.0.1:8880)
    if (
      s.sttEngine === "faster_whisper" &&
      Date.now() > whisperBridgeOfflineUntil
    ) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2200);
        const baseUrl = (s.whisperUrl || "http://127.0.0.1:8880").replace(
          /\/$/,
          ""
        );
        const res = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            audio_base64: audioBuffer.toString("base64"),
            mime_type: normalizedMime,
            model: "base.en",
            language: "en",
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.ok) {
          const data = (await res.json()) as { text?: string };
          if (data.text?.trim()) {
            this.lastProvider = "faster-whisper-local";
            return data.text.trim();
          }
        }
      } catch {
        whisperBridgeOfflineUntil = Date.now() + 45_000;
      }
    }

    // 2. Secondary: OpenAI Whisper API (if OPENAI_API_KEY is configured)
    if (s.sttEngine === "faster_whisper" && process.env.OPENAI_API_KEY) {
      try {
        const formData = new FormData();
        const blob = new Blob([new Uint8Array(audioBuffer)], {
          type: normalizedMime,
        });
        formData.append("file", blob, "command.webm");
        formData.append("model", "whisper-1");
        formData.append("language", "en");

        const res = await fetch(
          "https://api.openai.com/v1/audio/transcriptions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: formData,
          }
        );
        if (res.ok) {
          const data = (await res.json()) as { text?: string };
          if (data.text?.trim()) {
            this.lastProvider = "openai-whisper";
            return data.text.trim();
          }
        }
      } catch {
        // Fall through to Gemini audio transcription
      }
    }

    // 3. Tertiary: Gemini Multimodal Audio Transcription
    const base64Audio = audioBuffer.toString("base64");
    const candidateModels = [
      "gemini-3.5-transcribe",
      "gemini-3.1-flash-lite",
    ];

    for (const model of candidateModels) {
      if (isModelOnCooldown(model)) {
        continue;
      }

      try {
        const ai = getGeminiClient();
        const response = await ai.models.generateContent({
          model,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: normalizedMime,
                  data: base64Audio,
                },
              },
              {
                text: "Transcribe the spoken command accurately. If the audio is a tone or silence, reply with: Status report.",
              },
            ],
          },
        });

        const text = (response.text ?? "").trim();
        if (text) {
          this.lastProvider = "gemini-3.5-transcribe";
          return text;
        }
      } catch (err) {
        markModelCooldown(model, err);
      }
    }

    return "Status report";
  }
}
