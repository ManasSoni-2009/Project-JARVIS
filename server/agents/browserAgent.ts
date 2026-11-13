import { generateLLMText } from "../config.ts";

export class BrowserAgent {
  async execute(task: string): Promise<{
    output: string;
    sources?: Array<{ title: string; uri: string }>;
  }> {
    const hasUrl = /https?:\/\/\S+/i.test(task);

    try {
      const res = await generateLLMText({
        systemInstruction:
          "You are J.A.R.V.I.S's Browser Research Agent. Use live web search and URL context tools to investigate the user's request accurately and return a concise, factual summary.",
        prompt: task,
        useGoogleSearch: !hasUrl,
        useUrlContext: hasUrl,
        thinkingLevel: "high",
      });

      const output = res.text || "Web search completed, though no readable summary was returned.";
      return {
        output,
        sources: res.groundingUrls,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        output: `Browser agent encountered an issue: ${msg}`,
      };
    }
  }
}
