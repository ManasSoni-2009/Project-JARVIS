import {
  getGeminiClient,
  isModelOnCooldown,
  markModelCooldown,
} from "../config.ts";

export class STT {
  async transcribeBytes(
    audioBuffer: Buffer,
    mimeType = "audio/webm"
  ): Promise<string> {
    if (!audioBuffer || audioBuffer.length === 0) {
      return "";
    }

    const normalizedMime = mimeType.split(";")[0].trim() || "audio/webm";
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
          return text;
        }
      } catch (err) {
        markModelCooldown(model, err);
      }
    }

    return "Status report";
  }
}
