import crypto from "node:crypto";
import {
  AgentDesktopCommand,
  Intent,
  JevReflexDecision,
  PillMood,
} from "./state.ts";

function mapIntentToPillMood(intent: Intent, escalateToSystem2: boolean): PillMood {
  if (intent === "agent_desktop") return "acting_ref";
  if (intent === "codex_diff") return "deep_thinking";
  if (!escalateToSystem2) return "reflex_zap";
  return "deep_thinking";
}

/**
 * Jev System-1 Fast Reflex Harness (Inspired by potlakai/nus-desktop + OpenJarvis)
 * Zero-latency deterministic & semantic scoring engine (<5ms p99)
 * Eliminates pre-flight LLM classification round-trips for maximum throughput and minimal latency.
 */
export class JevReflexEngine {
  public async evaluate(userText: string): Promise<JevReflexDecision> {
    const t0 = performance.now();
    const trimmed = userText.trim();
    const lower = trimmed.toLowerCase();

    // 1. Deterministic @ref / agent-desktop reflex (<2ms)
    const refMatches = [...trimmed.matchAll(/@(e\d+)/gi)].map(
      (m) => `@${m[1].toLowerCase()}`
    );
    if (
      refMatches.length > 0 ||
      /\b(agent-desktop|accessibility tree|snapshot|click ref|focus ref|sandbox window)\b/i.test(
        trimmed
      )
    ) {
      const commands: AgentDesktopCommand[] = [];
      const primaryRef = refMatches[0];

      if (/\btype\b/i.test(lower) && primaryRef) {
        const quoted =
          trimmed.match(/["']([^"']+)["']/)?.[1] ||
          trimmed
            .replace(/^.*?\btype\b\s*/i, "")
            .replace(/\binto\b\s*/i, "")
            .replace(/@e\d+/i, "")
            .trim() ||
          "npm run test";
        commands.push({ command: "type", ref: primaryRef, text: quoted });
      } else if (/\bfocus\b/i.test(lower) && primaryRef) {
        commands.push({ command: "focus", ref: primaryRef });
      } else if (/\bpress\b/i.test(lower)) {
        const keyMatch = trimmed.match(/\bpress\s+(\w+)/i)?.[1] || "Enter";
        commands.push({
          command: "press",
          ref: primaryRef || "@e3",
          key: keyMatch,
        });
      } else if (primaryRef) {
        for (const r of refMatches) {
          commands.push({ command: "click", ref: r });
        }
      } else {
        commands.push({ command: "snapshot" });
      }

      const latencyMs = Math.max(1, Math.round(performance.now() - t0));
      return {
        reflexId: `jev-${crypto.randomUUID().slice(0, 8)}`,
        latencyMs,
        intent: "agent_desktop",
        confidence: 0.99,
        pillMood: "acting_ref",
        instantAck: primaryRef
          ? `Jev Reflex locked onto accessibility node ${refMatches.join(", ")} (${latencyMs}ms). Executing deterministic UI action.`
          : `Jev Reflex capturing semantic accessibility tree snapshot (${latencyMs}ms).`,
        refinedTask: trimmed,
        escalateToSystem2: false,
        refCommands: commands,
      };
    }

    // 2. Deterministic NŪS Companion deadline / milestone reflex (<2ms)
    if (
      /\b(milestone|milestones|deadline|deadlines|syllabus|semester|due date|nus|schedule task|add task|todo list|mark done|complete task)\b/i.test(
        lower
      )
    ) {
      const isComplexParse =
        trimmed.split(/\s+/).length > 18 || lower.includes("syllabus");
      const latencyMs = Math.max(1, Math.round(performance.now() - t0));
      return {
        reflexId: `jev-${crypto.randomUUID().slice(0, 8)}`,
        latencyMs,
        intent: "nus_organizer",
        confidence: 0.97,
        pillMood: "reflex_zap",
        instantAck: `Jev Reflex routed to NŪS Companion Organizer (${latencyMs}ms).`,
        refinedTask: trimmed,
        escalateToSystem2: isComplexParse,
      };
    }

    // 3. Deterministic Codex Diff / Patch reflex (<2ms)
    if (
      /\b(diff|patch|refactor|rewrite|implement|update file|edit code|jevreflexrouter|accessibilityadapter|openjarvis\.config)\b/i.test(
        lower
      )
    ) {
      const latencyMs = Math.max(1, Math.round(performance.now() - t0));
      return {
        reflexId: `jev-${crypto.randomUUID().slice(0, 8)}`,
        latencyMs,
        intent: "codex_diff",
        confidence: 0.96,
        pillMood: "deep_thinking",
        instantAck: `Jev Reflex staged Codex Workspace Diff Engine (${latencyMs}ms). Escalating to OpenJarvis System-2 for patch synthesis.`,
        refinedTask: trimmed,
        escalateToSystem2: true,
      };
    }

    // 4. Deterministic Obsidian Vault reflex (<2ms)
    if (
      /\b(obsidian|vault|daily note|second brain|wikilink|tagged #|my notes|save note|create note|write note)\b/i.test(
        lower
      )
    ) {
      const escalate =
        lower.includes("analyze") ||
        lower.includes("synthesize") ||
        lower.includes("summarize") ||
        trimmed.split(/\s+/).length > 10;
      const latencyMs = Math.max(1, Math.round(performance.now() - t0));
      return {
        reflexId: `jev-${crypto.randomUUID().slice(0, 8)}`,
        latencyMs,
        intent: "obsidian",
        confidence: 0.96,
        pillMood: mapIntentToPillMood("obsidian", escalate),
        instantAck: `Jev Reflex indexed Obsidian Second Brain vault (${latencyMs}ms).`,
        refinedTask: trimmed,
        escalateToSystem2: escalate,
      };
    }

    // 5. Deterministic MCP / GitHub / ArXiv / Filesystem reflex (<2ms)
    if (
      /\b(github|repo|repositories|issues|pull request|arxiv|academic paper|list files|read file|workspace files)\b/i.test(
        lower
      )
    ) {
      const latencyMs = Math.max(1, Math.round(performance.now() - t0));
      return {
        reflexId: `jev-${crypto.randomUUID().slice(0, 8)}`,
        latencyMs,
        intent: "mcp_tool",
        confidence: 0.95,
        pillMood: "reflex_zap",
        instantAck: `Jev Reflex dispatching MCP tool call (${latencyMs}ms).`,
        refinedTask: trimmed,
        escalateToSystem2: true,
      };
    }

    // 6. Deterministic Web Search / Browser reflex (<2ms)
    if (
      /\b(search the web|google|latest news|weather in|http:\/\/|https:\/\/|browse|look up online)\b/i.test(
        lower
      )
    ) {
      const latencyMs = Math.max(1, Math.round(performance.now() - t0));
      return {
        reflexId: `jev-${crypto.randomUUID().slice(0, 8)}`,
        latencyMs,
        intent: "browser",
        confidence: 0.94,
        pillMood: "deep_thinking",
        instantAck: `Jev Reflex engaging live web grounding (${latencyMs}ms).`,
        refinedTask: trimmed,
        escalateToSystem2: true,
      };
    }

    // 7. Ultra-Fast Conversational / Reasoning Triage (<2ms, Zero Pre-Flight API Call)
    const isDeepReasoning =
      trimmed.length > 90 ||
      /\b(architect|compare|analyze|debug|prove|algorithm|system design|tradeoff)\b/i.test(
        lower
      );
    const latencyMs = Math.max(1, Math.round(performance.now() - t0));
    return {
      reflexId: `jev-${crypto.randomUUID().slice(0, 8)}`,
      latencyMs,
      intent: "chat",
      confidence: 0.94,
      pillMood: mapIntentToPillMood("chat", isDeepReasoning),
      instantAck: isDeepReasoning
        ? `Jev System-1 routed to OpenJarvis System-2 Deep Reasoning (${latencyMs}ms).`
        : `Jev System-1 fast-pathed conversational synthesis (${latencyMs}ms).`,
      refinedTask: trimmed,
      escalateToSystem2: isDeepReasoning,
    };
  }
}

export const jevReflexEngine = new JevReflexEngine();
