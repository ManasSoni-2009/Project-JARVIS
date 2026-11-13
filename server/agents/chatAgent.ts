import { CHAT_SYSTEM } from "../brain/prompts.ts";
import { ChatTurnMessage, generateLLMText, getSettings, ThinkingMode } from "../config.ts";

function isComplexQuery(text: string): boolean {
  if (text.length > 90 || text.split(/\s+/).length > 16) return true;
  return /\b(why|how|explain|analyze|compare|design|architect|debug|prove|calculate|code|algorithm|tradeoff|strategy|difference)\b/i.test(
    text
  );
}

export class ChatAgent {
  async run(userText: string, history: ChatTurnMessage[] = []): Promise<string> {
    const recent = history.slice(-6);
    const messages: ChatTurnMessage[] =
      recent.length > 0 ? recent : [{ role: "user", content: userText }];

    const s = getSettings();
    let thinkingLevel: ThinkingMode = s.thinkingMode;
    if (thinkingLevel === "auto") {
      thinkingLevel = isComplexQuery(userText) ? "high" : "low";
    }

    const res = await generateLLMText({
      systemInstruction: CHAT_SYSTEM,
      history: messages,
      thinkingLevel,
    });

    return (
      res.text ||
      "I appear to have misplaced my train of thought, sir. Might you repeat that?"
    );
  }
}
