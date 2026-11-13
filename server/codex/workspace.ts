import fs from "node:fs/promises";
import path from "node:path";
import { generateLLMText } from "../config.ts";
import { CodexDiffPatch } from "../brain/state.ts";

const SANDBOX_DIR = path.resolve(process.cwd(), "data", "codex-workspace");

const STARTER_FILES: Record<string, string> = {
  "src/harness/jevReflexRouter.ts": `/**
 * Jev System-1 Fast Reflex Harness
 * Ultra-low-latency (<200ms) judgment and tool pre-staging layer.
 */
export interface ReflexConfig {
  maxLatencyMs: number;
  enableSpeculativePrefetch: boolean;
  confidenceThreshold: number;
}

export const defaultReflexConfig: ReflexConfig = {
  maxLatencyMs: 180,
  enableSpeculativePrefetch: true,
  confidenceThreshold: 0.82,
};

export function evaluateReflex(input: string, config = defaultReflexConfig) {
  const normalized = input.trim().toLowerCase();
  const isUrgentRef = /@e\\d+/.test(normalized);
  return {
    route: isUrgentRef ? "agent_desktop" : "openjarvis_system2",
    bypassSystem2: isUrgentRef,
    deadlineMs: config.maxLatencyMs,
  };
}
`,
  "src/desktop/accessibilityAdapter.ts": `/**
 * vercel-labs/agent-desktop Semantic Tree Adapter
 * Maps native OS accessibility nodes to deterministic @ref handles.
 */
export interface ElementRef {
  ref: string;
  role: string;
  label: string;
  bounds: [number, number, number, number];
}

export function formatRefEnvelope(nodes: ElementRef[]) {
  return {
    schema: "agent-desktop/v1",
    count: nodes.length,
    refs: nodes.map((n) => n.ref),
  };
}
`,
  "openjarvis.config.json": `{
  "engine": "openjarvis-v3",
  "primitives": ["intelligence", "engine", "agentic_logic", "tools_memory", "learning"],
  "system1": {
    "driver": "jev-reflex",
    "targetLatencyMs": 150
  },
  "system2": {
    "driver": "gemini-4-hydrogen",
    "thinkingLevel": "HIGH"
  }
}
`,
};

function computeUnifiedDiff(
  filePath: string,
  before: string,
  after: string
): { unifiedDiff: string; additions: number; deletions: number } {
  const oldLines = before.split("\n");
  const newLines = after.split("\n");
  const diffLines: string[] = [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    `@@ -1,${oldLines.length} +1,${newLines.length} @@`,
  ];

  let additions = 0;
  let deletions = 0;

  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === n && o !== undefined) {
      diffLines.push(` ${o}`);
    } else {
      if (o !== undefined) {
        diffLines.push(`-${o}`);
        deletions++;
      }
      if (n !== undefined) {
        diffLines.push(`+${n}`);
        additions++;
      }
    }
  }

  return {
    unifiedDiff: diffLines.join("\n"),
    additions,
    deletions,
  };
}

class CodexWorkspaceManager {
  private patches: CodexDiffPatch[] = [];
  private initialized = false;

  public async ensureWorkspace(): Promise<void> {
    if (this.initialized) return;
    await fs.mkdir(SANDBOX_DIR, { recursive: true });

    for (const [relPath, content] of Object.entries(STARTER_FILES)) {
      const fullPath = path.join(SANDBOX_DIR, relPath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      try {
        await fs.access(fullPath);
      } catch {
        await fs.writeFile(fullPath, content, "utf-8");
      }
    }

    // Seed an initial live diff patch so the Codex Diff Workbench is immediately populated
    const initialFile = "src/harness/jevReflexRouter.ts";
    const before = STARTER_FILES[initialFile];
    const after = `/**
 * Jev System-1 Fast Reflex Harness (Upgraded with Telemetry & Batch @ref Dispatch)
 * Ultra-low-latency (<150ms) judgment and tool pre-staging layer.
 */
export interface ReflexConfig {
  maxLatencyMs: number;
  enableSpeculativePrefetch: boolean;
  confidenceThreshold: number;
  enableTelemetryTrace: boolean;
}

export const defaultReflexConfig: ReflexConfig = {
  maxLatencyMs: 140,
  enableSpeculativePrefetch: true,
  confidenceThreshold: 0.88,
  enableTelemetryTrace: true,
};

export function evaluateReflex(input: string, config = defaultReflexConfig) {
  const normalized = input.trim().toLowerCase();
  const matchedRefs = normalized.match(/@e\\d+/g) ?? [];
  return {
    route: matchedRefs.length > 0 ? "agent_desktop" : "openjarvis_system2",
    matchedRefs,
    bypassSystem2: matchedRefs.length > 0 && normalized.length < 48,
    deadlineMs: config.maxLatencyMs,
    tracedAt: Date.now(),
  };
}
`;
    const { unifiedDiff, additions, deletions } = computeUnifiedDiff(initialFile, before, after);
    this.patches.push({
      id: "diff-seed-1",
      filePath: initialFile,
      title: "Add multi-@ref extraction & telemetry timestamps to Jev Reflex Router",
      language: "typescript",
      before,
      after,
      unifiedDiff,
      additions,
      deletions,
      applied: false,
      timestamp: new Date().toISOString(),
    });

    this.initialized = true;
  }

  public async listFiles(): Promise<Array<{ path: string; content: string }>> {
    await this.ensureWorkspace();
    const out: Array<{ path: string; content: string }> = [];
    const walk = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          await walk(full);
        } else {
          const rel = path.relative(SANDBOX_DIR, full).replace(/\\/g, "/");
          const content = await fs.readFile(full, "utf-8");
          out.push({ path: rel, content });
        }
      }
    };
    await walk(SANDBOX_DIR);
    return out;
  }

  public async getPatches(): Promise<CodexDiffPatch[]> {
    await this.ensureWorkspace();
    return [...this.patches];
  }

  public async applyPatch(patchId: string): Promise<CodexDiffPatch | null> {
    await this.ensureWorkspace();
    const patch = this.patches.find((p) => p.id === patchId);
    if (!patch) return null;
    const fullPath = path.join(SANDBOX_DIR, patch.filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, patch.after, "utf-8");
    patch.applied = true;
    return { ...patch };
  }

  public async revertPatch(patchId: string): Promise<CodexDiffPatch | null> {
    await this.ensureWorkspace();
    const patch = this.patches.find((p) => p.id === patchId);
    if (!patch) return null;
    const fullPath = path.join(SANDBOX_DIR, patch.filePath);
    await fs.writeFile(fullPath, patch.before, "utf-8");
    patch.applied = false;
    return { ...patch };
  }

  public async generateCodeDiffTask(userPrompt: string): Promise<{
    summary: string;
    patch: CodexDiffPatch;
  }> {
    await this.ensureWorkspace();
    const files = await this.listFiles();
    const targetFile =
      files.find((f) => userPrompt.toLowerCase().includes(path.basename(f.path).toLowerCase())) ||
      files[0];

    try {
      const res = await generateLLMText({
        systemInstruction: `You are the OpenAI Codex + OpenJarvis Code Diff Agent.
Given the target file and user request, produce an updated version of the file and a concise explanation.
Respond ONLY with valid JSON in this exact format:
{
  "filePath": "${targetFile.path}",
  "title": "Short 1-line commit/diff title",
  "summary": "2-sentence explanation of the code change and why it improves the system",
  "after": "Complete updated file source code"
}`,
        prompt: `Current file (${targetFile.path}):\n\`\`\`\n${targetFile.content}\n\`\`\`\n\nUser task: ${userPrompt}`,
        thinkingLevel: "high",
        responseMimeType: "application/json",
      });

      const parsed = JSON.parse(res.text) as {
        filePath?: string;
        title?: string;
        summary?: string;
        after?: string;
      };

      const filePath = parsed.filePath || targetFile.path;
      const before = targetFile.content;
      const after = parsed.after && parsed.after.trim().length > 10 ? parsed.after : before + `\n// Updated by Codex Agent: ${userPrompt}\n`;
      const { unifiedDiff, additions, deletions } = computeUnifiedDiff(filePath, before, after);

      const patch: CodexDiffPatch = {
        id: `diff-${Date.now()}`,
        filePath,
        title: parsed.title || `Update ${filePath}`,
        language: filePath.endsWith(".json") ? "json" : "typescript",
        before,
        after,
        unifiedDiff,
        additions,
        deletions,
        applied: false,
        timestamp: new Date().toISOString(),
      };
      this.patches.unshift(patch);

      return {
        summary:
          parsed.summary ||
          `Generated unified diff for ${filePath} (+${additions} / -${deletions} lines). Ready to review and apply in the Codex Workbench.`,
        patch,
      };
    } catch (err) {
      const after =
        targetFile.content +
        `\n// Codex Patch (${new Date().toISOString()}): ${userPrompt.replace(/\n/g, " ")}\n`;
      const { unifiedDiff, additions, deletions } = computeUnifiedDiff(
        targetFile.path,
        targetFile.content,
        after
      );
      const patch: CodexDiffPatch = {
        id: `diff-${Date.now()}`,
        filePath: targetFile.path,
        title: `Patch ${targetFile.path}`,
        language: "typescript",
        before: targetFile.content,
        after,
        unifiedDiff,
        additions,
        deletions,
        applied: false,
        timestamp: new Date().toISOString(),
      };
      this.patches.unshift(patch);
      return {
        summary: `Prepared unified diff for ${targetFile.path} (+${additions} / -${deletions}). (${err instanceof Error ? err.message : "Fallback diff"})`,
        patch,
      };
    }
  }
}

export const codexWorkspace = new CodexWorkspaceManager();
