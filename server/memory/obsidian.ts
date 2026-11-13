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
    await fs.mkdir(path.join(this.vaultPath, "Daily"), { recursive: true });
    const existing = await this.allNotes();
    const today = new Date().toISOString().slice(0, 10);

    const starterNotes: Array<{ relPath: string; body: string }> = [
      {
        relPath: "Welcome to JARVIS.md",
        body: `---\ntitle: Welcome to JARVIS\ncreated: ${today}\ntags: [jarvis, architecture, guide, onboarding]\n---\n\n# J.A.R.V.I.S v3.0 Second Brain Space\n\nWelcome to your integrated Obsidian Second Brain vault. Every markdown note here is indexed by the OpenJarvis 5-Primitive Memory Engine with automatic \`[[Wikilinks]]\` and \`#tag\` graph discovery.\n\n## Connected Knowledge Nodes\n- [[Project Architecture]] — 5-Primitive OpenJarvis core & Jev \`<3ms\` System-1 Reflex\n- [[Kokoro & Faster-Whisper Voice Engine]] — \`bm_george\` British RP movie J.A.R.V.I.S voice & Faster-Whisper STT\n- [[Agent-Desktop Semantic Refs]] — Deterministic \`@e1\`–\`@e17\` accessibility automation\n\n## Voice & Chat Commands\n- *"Analyze my Obsidian vault notes about architecture"*\n- *"Add to my daily note that Kokoro TTS and Faster-Whisper are online"*\n- *"Find my notes tagged #voice"*\n`,
      },
      {
        relPath: "Project Architecture.md",
        body: `---\ntitle: Project Architecture\ncreated: ${today}\ntags: [jarvis, architecture, openjarvis, jev]\n---\n\n# OpenJarvis 5-Primitive & Jev Reflex Architecture\n\n[[Welcome to JARVIS]] connects the **Jev System-1 Fast Reflex Harness** (\`<3ms\` deterministic triage) with five specialist subsystems:\n\n1. **Chat & Reasoning Engine** — Dynamic System-1 / System-2 synthesis with 1ms LRU cache.\n2. **Browser Grounding Agent** — Live Google Search and URL context verification.\n3. **Agent-Desktop Engine** — See [[Agent-Desktop Semantic Refs]] for \`@e1\`..\`@e17\` UI control.\n4. **MCP Tool Client** — Safe workspace filesystem, GitHub REST API, and ArXiv research.\n5. **Voice Pipeline** — Powered by [[Kokoro & Faster-Whisper Voice Engine]].\n`,
      },
      {
        relPath: "Kokoro & Faster-Whisper Voice Engine.md",
        body: `---\ntitle: Kokoro & Faster-Whisper Voice Engine\ncreated: ${today}\ntags: [jarvis, voice, kokoro, whisper]\n---\n\n# Kokoro-82M Neural TTS & Faster-Whisper STT\n\nLinked from [[Welcome to JARVIS]] and [[Project Architecture]].\n\n## Primary Cinema Voice (\`bm_george\`)\n- **Voice ID**: \`bm_george\` (Kokoro-82M British Male RP)\n- **Cadence**: Articulate, composed Paul Bettany J.A.R.V.I.S delivery (\`en-GB\`, speed \`1.03\`, pitch \`0.94\`)\n- **Additional Natural Personas**: \`bm_lewis\`, \`bm_fable\`, \`bf_emma\` (F.R.I.D.A.Y.), \`bf_isabella\`, \`am_adam\`, \`am_michael\`, \`af_heart\`, \`af_bella\`\n\n## Faster-Whisper Speech-to-Text\n- **Engine**: \`faster-whisper\` (\`base.en\` INT8) via \`scripts/voice_bridge.py\` (\`http://127.0.0.1:8880\`) + live browser speech streaming + multimodal fallback.\n`,
      },
      {
        relPath: "Agent-Desktop Semantic Refs.md",
        body: `---\ntitle: Agent-Desktop Semantic Refs\ncreated: ${today}\ntags: [jarvis, desktop, refs, automation]\n---\n\n# Semantic Desktop Automation (\`@e1\`–\`@e17\`)\n\nPart of [[Project Architecture]]. Maps active desktop windows into deterministic accessibility handles:\n\n- **Window 1 (Codex Build & Test Runner)**: \`@e1\`..\`@e7\` (\`Click @e4\` runs CI verification)\n- **Window 2 (NŪS Companion Scratchpad)**: \`@e8\`..\`@e13\` (\`Click @e12\` syncs scratchpad to [[Welcome to JARVIS]])\n- **Window 3 (System Daemons)**: \`@e14\`..\`@e17\`\n`,
      },
      {
        relPath: path.join("Daily", `${today}.md`),
        body: `---\ntitle: Daily Note - ${today}\ncreated: ${today}\ntags: [daily, jarvis, log]\n---\n\n# Daily Engineering Log — ${today}\n\n- **09:00**: Initialized [[Welcome to JARVIS]] and verified [[Kokoro & Faster-Whisper Voice Engine]] with \`bm_george\` British RP voice.\n- **09:15**: Confirmed [[Agent-Desktop Semantic Refs]] (\`@e1\`..\`@e17\`) and [[Project Architecture]] telemetry.\n`,
      },
    ];

    if (existing.length <= 2) {
      for (const item of starterNotes) {
        const fullPath = path.join(this.vaultPath, item.relPath);
        try {
          await fs.access(fullPath);
        } catch {
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, item.body, "utf-8");
        }
      }
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

  private extractTagsAndLinks(rawContent: string): {
    tags: string[];
    links: string[];
  } {
    const tagSet = new Set<string>();
    const fmTagsMatch = rawContent.match(/tags:\s*\[([^\]]+)\]/i);
    if (fmTagsMatch) {
      for (const raw of fmTagsMatch[1].split(",")) {
        const clean = raw.trim().replace(/^['"#]|['"]$/g, "").toLowerCase();
        if (clean) tagSet.add(clean);
      }
    }
    for (const m of rawContent.matchAll(/(?:^|\s)#([a-zA-Z0-9_-]{2,28})/g)) {
      tagSet.add(m[1].toLowerCase());
    }

    const linkSet = new Set<string>();
    for (const m of rawContent.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) {
      const target = m[1].trim();
      if (target) linkSet.add(target);
    }

    return {
      tags: Array.from(tagSet),
      links: Array.from(linkSet),
    };
  }

  async listNotes(): Promise<
    Array<{
      name: string;
      stem: string;
      preview: string;
      content: string;
      tags: string[];
      links: string[];
      backlinks: string[];
      folder: string;
      updatedAt: string;
    }>
  > {
    await this.ensureVault();
    const files = await this.allNotes();
    const rawItems = await Promise.all(
      files.map(async (filePath) => {
        const stat = await fs.stat(filePath);
        const content = await fs.readFile(filePath, "utf-8");
        const preview = await this.excerpt(filePath, 160);
        const { tags, links } = this.extractTagsAndLinks(content);
        const relDir = path.relative(this.vaultPath, path.dirname(filePath));
        return {
          name: path.basename(filePath),
          stem: path.basename(filePath, ".md"),
          preview,
          content,
          tags,
          links,
          backlinks: [] as string[],
          folder: relDir === "" || relDir === "." ? "Root" : relDir,
          updatedAt: stat.mtime.toISOString(),
        };
      })
    );

    // Populate backlinks across notes
    for (const item of rawItems) {
      item.backlinks = rawItems
        .filter(
          (other) =>
            other.stem !== item.stem &&
            other.links.some(
              (l) => l.toLowerCase() === item.stem.toLowerCase()
            )
        )
        .map((other) => other.stem);
    }

    return rawItems.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async deleteNote(stem: string): Promise<boolean> {
    await this.ensureVault();
    const files = await this.allNotes();
    const target = files.find(
      (f) => path.basename(f, ".md").toLowerCase() === stem.trim().toLowerCase()
    );
    if (!target) return false;
    await fs.unlink(target);
    return true;
  }

  async writeNote(title: string, content: string, append = false): Promise<string> {
    await this.ensureVault();
    const safeTitle = title.replace(/[<>:"/\\|?*]/g, "_").trim() || "Untitled";
    const files = await this.allNotes();
    const existingFile = files.find(
      (f) => path.basename(f, ".md").toLowerCase() === safeTitle.toLowerCase()
    );
    const filePath = existingFile || path.join(this.vaultPath, `${safeTitle}.md`);
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

    if (linked.trimStart().startsWith("---")) {
      await fs.writeFile(filePath, linked, "utf-8");
      return `Saved note '${safeTitle}.md'.`;
    }

    const frontmatter = `---\ntitle: ${safeTitle}\ncreated: ${dateStr}\ntags: [jarvis]\n---\n\n`;
    await fs.writeFile(filePath, frontmatter + linked, "utf-8");
    return `Saved note '${safeTitle}.md'.`;
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
