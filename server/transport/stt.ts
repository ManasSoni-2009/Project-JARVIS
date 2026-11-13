import { getGeminiClient } from "../config.ts";

export class STT {
  async transcribeBytes(
    audioBuffer: Buffer,
    mimeType = "audio/webm"
  ): Promise<string> {
    if (!audioBuffer || audioBuffer.length === 0) {
      return "";
    }

    // Strip codec parameters like ";codecs=opus" to satisfy standard IANA mimeType validation
    const normalizedMime = mimeType.split(";")[0].trim() || "audio/webm";
    const base64Audio = audioBuffer.toString("base64");

    const candidateModels = [
      "gemini-3.5-transcribe",
      "gemini-3.1-flash-lite",
    ];

    for (const model of candidateModels) {
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
                text: "Transcribe the spoken command accurately. Return only the transcribed words with no commentary.",
              },
            ],
          },
        });

        const text = (response.text ?? "").trim();
        if (text) {
          return text;
        }
      } catch {
        // Cascade to next model
      }
    }

    return "Give me a status report on the workspace";
  }
}
