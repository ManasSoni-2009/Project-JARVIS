import { getSettings } from "../config.ts";

export class OSAgent {
  async execute(task: string): Promise<string> {
    const s = getSettings();
    return (
      `Desktop automation via ${s.osBackend === "openclaw" ? "OpenClaw CLI" : "PyAutoGUI / Gemini Vision"} ` +
      `requires a local Windows desktop session and cannot directly manipulate windows from this cloud web environment. ` +
      `Requested OS task: "${task}". I can, however, execute web research, GitHub/MCP tools, or Obsidian note operations right here.`
    );
  }
}
