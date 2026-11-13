import fs from "node:fs/promises";
import path from "node:path";
import { generateLLMText, getSettings } from "../config.ts";

interface NoteHit {
  filePath: string;
  stem: string;
  excerpt: string;
}

export class ObsidianMemory {
  private vaultPath: string;

  constructor(vaultPath?: string) {
    this.vaultPath = vaultPath || getSettings().obsidianVaultPath;
  }

  async ensureVault(): Promise<void> {
    await fs.mkdir(this.vaultPath, { recursive: true });
    const existing = await this.allNotes();
    if (existing.length === 0) {
      const today = new Date().toISOString().slice(0, 10);
      await fs.writeFile(
        path.join(this.vaultPath, "Welcome to JARVIS.md"),
        `---\ntitle: Welcome to JARVIS\ncreated: ${today}\ntags: [jarvis, architecture, guide]\n---\n\n# J.A.R.V.I.S Second Brain\n\nThis Obsidian-compatible markdown vault stores notes, daily logs, and project knowledge.\n\nTry commands such as:\n- "Find my notes tagged #jarvis"\n- "Add to my daily note that Project JARVIS is online"\n- "Analyze my notes about architecture"\n`,
        "utf-8"
      );
      await fs.writeFile(
        path.join(this.vaultPath, "Project Architecture.md"),
        `---\ntitle: Project Architecture\ncreated: ${today}\ntags: [jarvis, multi-agent, gemini]\n---\n\n# Multi-Agent Architecture\n\n[[Welcome to JARVIS]] connects a supervisor router to five specialist agents:\n1. **Chat Agent** — Conversational assistant with deep thinking.\n2. **Browser Agent** — Live web search and URL synthesis.\n3. **OS / OpenClaw** — Desktop automation adapter.\n4. **MCP Client** — Filesystem, GitHub API, and ArXiv research tools.\n5. **Obsidian Memory** — Markdown vault search, daily logs, and RAG synthesis.\n`,
        "utf-8"
      );
    }
  }

  async query(naturalQuery: string): Promise<string> {
    await this.ensureVault();
    const qLower = naturalQuery.toLowerCase();

    // Daily note intents
    if (qLower.includes("daily") || qLower.includes("today")) {
      const writeWords = ["add", "append", "write", "log", "note down", "record", "put"];
      if (writeWords.some((w) => qLower.includes(w))) {
        let content = naturalQuery
          .replace(/^(.*?)(?:to my daily note|to today's note|in my daily note|that)\s*/i, "")
          .trim();
        if (!content || content === naturalQuery) {
          content = naturalQuery;
        }
        return this.appendToDailyNote(content);
      }
      if (["read", "show", "what", "open", "get", "view"].some((r) => qLower.includes(r))) {
        return this.getDailyNote();
      }
    }

    // Create/write note intent
    if (/\b(create|save|write)\b.*\bnote\b/i.test(naturalQuery) && !qLower.includes("daily")) {
      const titleMatch = naturalQuery.match(/(?:called|named|titled|about)\s+['"]?([^'"]+?)['"]?(?:\s+(?:saying|with|content|:)\s+(.+))?$/i);
      if (titleMatch) {
        const title = titleMatch[1].trim().slice(0, 60);
        const body = titleMatch[2]?.trim() || naturalQuery;
        return this.writeNote(title, body, false);
      }
    }

    // Deep RAG analytical intents
    const ragWords = new Set([
      "analyze",
      "synthesize",
      "summarize",
      "why",
      "how",
      "compare",
      "explain",
      "relationship",
      "connect",
      "deep",
    ]);
    const words = qLower.split(/\s+/);
    if (words.some((w) => ragWords.has(w)) || words.length > 8) {
      return this.deepRagQuery(naturalQuery);
    }

    const parsed = this.parseQuery(naturalQuery);
    const results = await this.executeQuery(parsed);
    if (results.length === 0) {
      return `No notes found in the vault matching: '${naturalQuery}'.`;
    }

    const lines = [`Found ${results.length} note(s):`];
    for (const hit of results.slice(0, 5)) {
      lines.push(`- ${hit.stem}: ${hit.excerpt.slice(0, 180)}`);
    }
    return lines.join("\n");
  }

  async listNotes(): Promise<Array<{ name: string; stem: string; preview: string; updatedAt: string }>> {
    await this.ensureVault();
    const files = await this.allNotes();
    const items = await Promise.all(
      files.map(async (filePath) => {
        const stat = await fs.stat(filePath);
        const preview = await this.excerpt(filePath, 140);
        return {
          name: path.basename(filePath),
          stem: path.basename(filePath, ".md"),
          preview,
          updatedAt: stat.mtime.toISOString(),
        };
      })
    );
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async writeNote(title: string, content: string, append = false): Promise<string> {
    await this.ensureVault();
    const safeTitle = title.replace(/[<>:"/\\|?*]/g, "_").trim() || "Untitled";
    const filePath = path.join(this.vaultPath, `${safeTitle}.md`);
    const linked = await this.autoLink(content);
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5);

    if (append) {
      try {
        const existing = await fs.readFile(filePath, "utf-8");
        await fs.writeFile(
          filePath,
          `${existing}\n\n---\n*JARVIS added ${dateStr} ${timeStr}*\n${linked}`,
          "utf-8"
        );
        return `Appended to '${safeTitle}.md'.`;
      } catch {
        // Fall through to create
      }
    }

    const frontmatter = `---\ntitle: ${safeTitle}\ncreated: ${dateStr}\ntags: [jarvis]\n---\n\n`;
    await fs.writeFile(filePath, frontmatter + linked, "utf-8");
    return `Created note '${safeTitle}.md'.`;
  }

  async getDailyNote(): Promise<string> {
    await this.ensureVault();
    const today = new Date().toISOString().slice(0, 10);
    const candidates = [
      path.join(this.vaultPath, "Daily", `${today}.md`),
      path.join(this.vaultPath, `${today}.md`),
    ];
    for (const candidate of candidates) {
      try {
        return await fs.readFile(candidate, "utf-8");
      } catch {
        // continue
      }
    }
    return `No daily note found for today (${today}).`;
  }

  async appendToDailyNote(content: string): Promise<string> {
    await this.ensureVault();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const timestamp = now.toTimeString().slice(0, 5);
    const dailyDir = path.join(this.vaultPath, "Daily");
    await fs.mkdir(dailyDir, { recursive: true });
    const filePath = path.join(dailyDir, `${today}.md`);
    const linked = await this.autoLink(content);

    try {
      const existing = await fs.readFile(filePath, "utf-8");
      await fs.writeFile(filePath, `${existing}\n- **${timestamp}**: ${linked}`, "utf-8");
      return `Logged to Daily/${today}.md.`;
    } catch {
      const initial = `---\ntitle: Daily Note - ${today}\ncreated: ${today}\ntags: [daily, jarvis]\n---\n\n# Daily Log - ${today}\n\n- **${timestamp}**: ${linked}`;
      await fs.writeFile(filePath, initial, "utf-8");
      return `Created daily note Daily/${today}.md.`;
    }
  }

  async deepRagQuery(question: string): Promise<string> {
    let results = await this.keywordSearch(question);
    if (results.length === 0) {
      const files = await this.allNotes();
      const withTime = await Promise.all(
        files.map(async (f) => ({ f, mtime: (await fs.stat(f)).mtimeMs }))
      );
      withTime.sort((a, b) => b.mtime - a.mtime);
      results = await Promise.all(
        withTime.slice(0, 5).map(async ({ f }) => ({
          filePath: f,
          stem: path.basename(f, ".md"),
          excerpt: await this.excerpt(f, 500),
        }))
      );
    }

    if (results.length === 0) {
      return "Your Obsidian vault currently contains no notes to analyze.";
    }

    const contextStr = results
      .slice(0, 6)
      .map((r) => `### Note: ${r.stem}\n${r.excerpt}`)
      .join("\n\n");

    try {
      const res = await generateLLMText({
        systemInstruction:
          "You are J.A.R.V.I.S, analyzing the user's Obsidian Second Brain vault. Use the provided note excerpts to answer the user's analytical question comprehensively and concisely. If the exact answer isn't in the notes, synthesize insights from the available context and clearly state what is known.",
        prompt: `Context from Vault:\n${contextStr}\n\nUser Question: ${question}`,
        thinkingLevel: "high",
      });
      return res.text || contextStr;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `Retrieved ${results.length} note(s), but synthesis failed: ${message}\n\n${contextStr.slice(0, 800)}`;
    }
  }

  private parseQuery(text: string): { type: "tag" | "property" | "note_name" | "keyword"; value: string; key?: string } {
    const lower = text.toLowerCase();
    const tagMatch = lower.match(/(?:tagged?|tag)\s+#?(\w+)/);
    if (tagMatch) {
      return { type: "tag", value: tagMatch[1] };
    }
    const propMatch = lower.match(/where\s+(\w+)\s*[=:]\s*(\S+)/);
    if (propMatch) {
      return { type: "property", key: propMatch[1], value: propMatch[2] };
    }
    const noteMatch = lower.match(/(?:read|open|show|get).*?(?:note|notes?)\s+(?:about|called|named|on)?\s*['"]?(.+?)['"]?$/);
    if (noteMatch) {
      return { type: "note_name", value: noteMatch[1].trim() };
    }
    const keywords = lower
      .replace(/\b(find|search|look for|notes?|my|about|in|obsidian)\b/g, "")
      .trim();
    return { type: "keyword", value: keywords || text };
  }

  private async executeQuery(parsed: {
    type: "tag" | "property" | "note_name" | "keyword";
    value: string;
    key?: string;
  }): Promise<NoteHit[]> {
    if (parsed.type === "tag") {
      return this.tagSearch(parsed.value);
    }
    if (parsed.type === "property" && parsed.key) {
      return this.propertySearch(parsed.key, parsed.value);
    }
    if (parsed.type === "note_name") {
      const files = await this.allNotes();
      const target = parsed.value.toLowerCase();
      const matched = files.filter((f) => path.basename(f, ".md").toLowerCase().includes(target));
      return Promise.all(
        matched.slice(0, 10).map(async (f) => ({
          filePath: f,
          stem: path.basename(f, ".md"),
          excerpt: await this.excerpt(f),
        }))
      );
    }
    return this.keywordSearch(parsed.value);
  }

  private async keywordSearch(keyword: string): Promise<NoteHit[]> {
    const files = await this.allNotes();
    const terms = keyword
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);
    const needle = keyword.toLowerCase();
    const hits: NoteHit[] = [];

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const lower = content.toLowerCase();
        const stem = path.basename(filePath, ".md");
        if (lower.includes(needle) || terms.some((t) => lower.includes(t) || stem.toLowerCase().includes(t))) {
          hits.push({
            filePath,
            stem,
            excerpt: this.findExcerpt(content, terms[0] || needle),
          });
        }
      } catch {
        // skip
      }
    }
    return hits;
  }

  private async tagSearch(tag: string): Promise<NoteHit[]> {
    const files = await this.allNotes();
    const t = tag.toLowerCase();
    const hits: NoteHit[] = [];
    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const lower = content.toLowerCase();
        if (lower.includes(`#${t}`) || new RegExp(`tags:\\s*\\[[^\\]]*\\b${t}\\b`).test(lower)) {
          hits.push({
            filePath,
            stem: path.basename(filePath, ".md"),
            excerpt: await this.excerpt(filePath),
          });
        }
      } catch {
        // skip
      }
    }
    return hits;
  }

  private async propertySearch(key: string, value: string): Promise<NoteHit[]> {
    const files = await this.allNotes();
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedVal = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`^${escapedKey}\\s*:\\s*${escapedVal}`, "mi");
    const hits: NoteHit[] = [];
    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, "utf-8");
        if (pattern.test(content)) {
          hits.push({
            filePath,
            stem: path.basename(filePath, ".md"),
            excerpt: await this.excerpt(filePath),
          });
        }
      } catch {
        // skip
      }
    }
    return hits;
  }

  private async allNotes(): Promise<string[]> {
    const out: string[] = [];
    const walk = async (dir: string) => {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
          out.push(full);
        }
      }
    };
    await walk(this.vaultPath);
    return out;
  }

  private async excerpt(filePath: string, maxChars = 220): Promise<string> {
    try {
      let content = await fs.readFile(filePath, "utf-8");
      if (content.startsWith("---")) {
        const end = content.indexOf("---", 3);
        if (end > 0) {
          content = content.slice(end + 3).trim();
        }
      }
      return content.slice(0, maxChars).replace(/\s+/g, " ");
    } catch {
      return "";
    }
  }

  private findExcerpt(content: string, keyword: string, context = 110): string {
    const idx = content.toLowerCase().indexOf(keyword.toLowerCase());
    if (idx < 0) return content.slice(0, 140).replace(/\s+/g, " ");
    const start = Math.max(0, idx - context);
    const end = Math.min(content.length, idx + keyword.length + context);
    return `...${content.slice(start, end).replace(/\s+/g, " ")}...`;
  }

  private async autoLink(content: string): Promise<string> {
    const ignore = new Set([
      "daily",
      "note",
      "notes",
      "todo",
      "index",
      "jarvis",
      "log",
      "test",
      "demo",
      "work",
      "home",
      "draft",
    ]);
    const files = await this.allNotes();
    const stems = files
      .map((f) => path.basename(f, ".md"))
      .filter((s) => s.length > 2 && !ignore.has(s.toLowerCase()))
      .sort((a, b) => b.length - a.length);

    let result = content;
    for (const stem of stems) {
      const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(?<!\\[\\[)\\b(${escaped})\\b(?!\\]\\])`, "gi");
      result = result.replace(regex, "[[$1]]");
    }
    return result;
  }
}
