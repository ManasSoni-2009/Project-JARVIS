import crypto from "node:crypto";
import { agentDesktopEngine } from "../agentDesktop/engine.ts";
import { BrowserAgent } from "../agents/browserAgent.ts";
import { ChatAgent } from "../agents/chatAgent.ts";
import { codexWorkspace } from "../codex/workspace.ts";
import { ChatTurnMessage, getSettings } from "../config.ts";
import { MCPClient } from "../mcp/client.ts";
import { ObsidianMemory } from "../memory/obsidian.ts";
import { nusOrganizer } from "../nus/organizer.ts";
import { jevReflexEngine } from "./jevReflex.ts";
import {
  AgentDesktopEnvelope,
  CodexDiffPatch,
  Intent,
  JevReflexDecision,
  OpenJarvisTrace,
  PillMood,
  TerminalLogEntry,
  TraceStep,
} from "./state.ts";

export interface SupervisorResult {
  finalResponse: string;
  intent: Intent;
  intentConfidence: number;
  agentOutput: string;
  sessionId: string;
  sources?: Array<{ title: string; uri: string }>;
  jevDecision: JevReflexDecision;
  trace: OpenJarvisTrace;
  codeDiff?: CodexDiffPatch | null;
  desktopEnvelope?: AgentDesktopEnvelope | null;
}

export interface SupervisorCallbacks {
  onJevReflex?: (decision: JevReflexDecision) => Promise<void> | void;
  onStep?: (step: TraceStep, mood: PillMood) => Promise<void> | void;
  onTerminalLog?: (entry: TerminalLogEntry) => Promise<void> | void;
}

export class Supervisor {
  private chatAgent = new ChatAgent();
  private browserAgent = new BrowserAgent();
  private mcpClient = new MCPClient();
  private obsidian = new ObsidianMemory();
  private conversationHistory: ChatTurnMessage[] = [];
  private traces: OpenJarvisTrace[] = [];
  private terminalLogs: TerminalLogEntry[] = [];

  public async build(): Promise<void> {
    await this.obsidian.ensureVault();
    await codexWorkspace.ensureWorkspace();

    this.pushTerminalLog({
      subsystem: "OPENJARVIS-SYS2",
      command: "openjarvis init --primitives=5 --reflex=jev",
      output:
        "Initialized [Intelligence, Engine, AgenticLogic, ToolsMemory, Learning] + Jev System-1 Harness",
      status: "ok",
    });
  }

  public getTraces(limit = 25): OpenJarvisTrace[] {
    return this.traces.slice(0, limit);
  }

  public getTerminalLogs(limit = 60): TerminalLogEntry[] {
    return this.terminalLogs.slice(0, limit);
  }

  public pushTerminalLog(
    entry: Omit<TerminalLogEntry, "id" | "timestamp">
  ): TerminalLogEntry {
    const full: TerminalLogEntry = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.terminalLogs.unshift(full);
    if (this.terminalLogs.length > 100) {
      this.terminalLogs = this.terminalLogs.slice(0, 100);
    }
    return full;
  }

  public async run(
    userText: string,
    callbacks?: SupervisorCallbacks,
    explicitSessionId?: string
  ): Promise<SupervisorResult> {
    const tStart = performance.now();
    const sessionId = explicitSessionId || "sess-codex-jev-router";
    const steps: TraceStep[] = [];
    const settings = getSettings();

    // ── PHASE 1: Jev System-1 Fast Reflex Pass (<3ms) ──────────────────────
    const jevDecision = await jevReflexEngine.evaluate(userText);
    if (callbacks?.onJevReflex) {
      await callbacks.onJevReflex(jevDecision);
    }

    const jevStep: TraceStep = {
      id: `step-jev-${Date.now()}-${crypto.randomUUID().slice(0, 4)}`,
      phase: "jev_reflex",
      title: `Jev System-1 Reflex (${jevDecision.intent})`,
      command: `jev triage --intent=${jevDecision.intent} --confidence=${jevDecision.confidence}`,
      detail: jevDecision.instantAck,
      durationMs: jevDecision.latencyMs,
      status: "done",
    };
    steps.push(jevStep);
    if (callbacks?.onStep) {
      await callbacks.onStep(jevStep, jevDecision.pillMood);
    }

    const jevLog = this.pushTerminalLog({
      subsystem: "JEV-SYS1",
      command: `jev.evaluate("${userText.slice(0, 60)}")`,
      output: `[${jevDecision.latencyMs}ms] intent=${jevDecision.intent} escalate=${jevDecision.escalateToSystem2} :: ${jevDecision.instantAck}`,
      status: "ok",
    });
    if (callbacks?.onTerminalLog) {
      await callbacks.onTerminalLog(jevLog);
    }

    // Track rolling chat history
    this.conversationHistory.push({ role: "user", content: userText });
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }

    let agentOutput = "";
    let finalResponse = "";
    let sources: Array<{ title: string; uri: string }> | undefined;
    let codeDiff: CodexDiffPatch | null = null;
    let desktopEnvelope: AgentDesktopEnvelope | null = null;

    const tSys2Start = performance.now();

    // ── PHASE 2: Specialist Execution (System-1 Direct or System-2 Deep) ───
    switch (jevDecision.intent) {
      case "agent_desktop": {
        const cmds =
          jevDecision.refCommands && jevDecision.refCommands.length > 0
            ? jevDecision.refCommands
            : [{ command: "snapshot" as const }];

        const summaries: string[] = [];
        for (const cmd of cmds) {
          const stepStart = performance.now();
          desktopEnvelope = agentDesktopEngine.executeCommand(cmd);

          // If @e12 ("Sync Note to Obsidian Vault") was triggered, commit scratchpad to Vault
          if (desktopEnvelope.targetRef === "@e12" && cmd.command === "click") {
            const sb = agentDesktopEngine.getSandboxState();
            const noteMsg = await this.obsidian.writeNote(
              sb.quickNoteTitle || "NŪS Scratchpad Note",
              sb.quickNoteBody || "Synced via @e12 agent-desktop action.",
              false
            );
            desktopEnvelope.summary = `${desktopEnvelope.summary} (${noteMsg})`;
          }

          summaries.push(desktopEnvelope.summary);

          const adStep: TraceStep = {
            id: `step-ad-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            phase: "agent_desktop",
            title: `agent-desktop ${cmd.command} ${cmd.ref || ""}`.trim(),
            command: `agent-desktop ${cmd.command}${cmd.ref ? ` --ref ${cmd.ref}` : ""}${cmd.text ? ` --text "${cmd.text}"` : ""}`,
            detail: desktopEnvelope.summary,
            durationMs: Math.max(1, Math.round(performance.now() - stepStart)),
            status: desktopEnvelope.ok ? "done" : "error",
          };
          steps.push(adStep);
          if (callbacks?.onStep) {
            await callbacks.onStep(adStep, "acting_ref");
          }

          const adLog = this.pushTerminalLog({
            subsystem: "AGENT-DESKTOP",
            command: adStep.command || "agent-desktop snapshot",
            output: JSON.stringify({
              ok: desktopEnvelope.ok,
              mode: desktopEnvelope.mode,
              ref: desktopEnvelope.targetRef,
              summary: desktopEnvelope.summary,
            }),
            status: desktopEnvelope.ok ? "ok" : "warn",
          });
          if (callbacks?.onTerminalLog) {
            await callbacks.onTerminalLog(adLog);
          }
        }

        agentOutput = summaries.join("\n");
        finalResponse = `Executed via agent-desktop (${desktopEnvelope?.mode || "web_sandbox"}): ${agentOutput}`;
        break;
      }

      case "codex_diff": {
        const stepStart = performance.now();
        const diffRes = await codexWorkspace.generateCodeDiffTask(userText);
        codeDiff = diffRes.patch;
        agentOutput = diffRes.summary;
        finalResponse = diffRes.summary;

        const diffStep: TraceStep = {
          id: `step-diff-${Date.now()}`,
          phase: "diff_generated",
          title: `Codex Unified Diff: ${codeDiff.filePath}`,
          command: `git diff a/${codeDiff.filePath} b/${codeDiff.filePath}`,
          detail: `+${codeDiff.additions} / -${codeDiff.deletions} lines — ${codeDiff.title}`,
          durationMs: Math.max(1, Math.round(performance.now() - stepStart)),
          status: "done",
        };
        steps.push(diffStep);
        if (callbacks?.onStep) {
          await callbacks.onStep(diffStep, "deep_thinking");
        }

        const diffLog = this.pushTerminalLog({
          subsystem: "CODEX-DIFF",
          command: `codex patch ${codeDiff.filePath}`,
          output: `Generated patch ${codeDiff.id}: +${codeDiff.additions} -${codeDiff.deletions} (${codeDiff.title})`,
          status: "ok",
        });
        if (callbacks?.onTerminalLog) {
          await callbacks.onTerminalLog(diffLog);
        }
        break;
      }

      case "nus_organizer": {
        const stepStart = performance.now();
        const nusRes = await nusOrganizer.handleNaturalCommand(userText);
        agentOutput = nusRes.summary;
        finalResponse = nusRes.summary;

        const nusStep: TraceStep = {
          id: `step-nus-${Date.now()}`,
          phase: "tool_call",
          title: "NŪS Companion Milestone Sync",
          command: "nus-desktop sync --milestones",
          detail: nusRes.summary,
          durationMs: Math.max(1, Math.round(performance.now() - stepStart)),
          status: "done",
        };
        steps.push(nusStep);
        if (callbacks?.onStep) {
          await callbacks.onStep(nusStep, "reflex_zap");
        }

        const nusLog = this.pushTerminalLog({
          subsystem: "NUS-COMPANION",
          command: "nus.handleNaturalCommand()",
          output: nusRes.summary,
          status: "ok",
        });
        if (callbacks?.onTerminalLog) {
          await callbacks.onTerminalLog(nusLog);
        }
        break;
      }

      case "browser": {
        const stepStart = performance.now();
        const res = await this.browserAgent.execute(
          jevDecision.refinedTask || userText
        );
        agentOutput = res.output;
        sources = res.sources;
        finalResponse = agentOutput;

        const bStep: TraceStep = {
          id: `step-browser-${Date.now()}`,
          phase: "tool_call",
          title: "Live Web Grounding & URL Context",
          command: `openjarvis.browser.search("${(jevDecision.refinedTask || userText).slice(0, 48)}")`,
          detail: agentOutput.slice(0, 220),
          durationMs: Math.max(1, Math.round(performance.now() - stepStart)),
          status: "done",
        };
        steps.push(bStep);
        if (callbacks?.onStep) {
          await callbacks.onStep(bStep, "deep_thinking");
        }
        break;
      }

      case "mcp_tool": {
        const stepStart = performance.now();
        agentOutput = await this.mcpClient.handle(
          jevDecision.refinedTask || userText
        );
        finalResponse = agentOutput;

        const mStep: TraceStep = {
          id: `step-mcp-${Date.now()}`,
          phase: "tool_call",
          title: "MCP Tool Execution",
          command: `mcp.dispatch("${(jevDecision.refinedTask || userText).slice(0, 48)}")`,
          detail: agentOutput.slice(0, 220),
          durationMs: Math.max(1, Math.round(performance.now() - stepStart)),
          status: "done",
        };
        steps.push(mStep);
        if (callbacks?.onStep) {
          await callbacks.onStep(mStep, "deep_thinking");
        }

        const mcpLog = this.pushTerminalLog({
          subsystem: "MCP",
          command: mStep.command || "mcp.dispatch",
          output: agentOutput.slice(0, 260),
          status: "ok",
        });
        if (callbacks?.onTerminalLog) {
          await callbacks.onTerminalLog(mcpLog);
        }
        break;
      }

      case "obsidian": {
        const stepStart = performance.now();
        agentOutput = await this.obsidian.query(userText);
        finalResponse = agentOutput;

        const oStep: TraceStep = {
          id: `step-obs-${Date.now()}`,
          phase: "tool_call",
          title: "Obsidian Second Brain Vault Query",
          command: `obsidian.query("${userText.slice(0, 48)}")`,
          detail: agentOutput.slice(0, 220),
          durationMs: Math.max(1, Math.round(performance.now() - stepStart)),
          status: "done",
        };
        steps.push(oStep);
        if (callbacks?.onStep) {
          await callbacks.onStep(oStep, "reflex_zap");
        }
        break;
      }

      case "chat":
      default: {
        const stepStart = performance.now();
        agentOutput = await this.chatAgent.run(
          userText,
          this.conversationHistory
        );
        finalResponse = agentOutput;

        const cStep: TraceStep = {
          id: `step-chat-${Date.now()}`,
          phase: "thought",
          title: "OpenJarvis Cognitive Synthesis",
          command: `openjarvis.generate --model=${settings.geminiModel} --thinking=${settings.thinkingMode}`,
          detail: `Synthesized response (${agentOutput.length} chars)`,
          durationMs: Math.max(1, Math.round(performance.now() - stepStart)),
          status: "done",
        };
        steps.push(cStep);
        if (callbacks?.onStep) {
          await callbacks.onStep(cStep, "deep_thinking");
        }
        break;
      }
    }

    const system2Ms = Math.max(0, Math.round(performance.now() - tSys2Start));
    const totalMs = Math.max(1, Math.round(performance.now() - tStart));

    this.conversationHistory.push({ role: "assistant", content: finalResponse });

    // ── PHASE 3: Record OpenJarvis Learning & ExecutionTrace ───────────────
    const estTokens = Math.max(
      48,
      Math.round((userText.length + finalResponse.length) / 3.6)
    );
    const trace: OpenJarvisTrace = {
      traceId: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      userPrompt: userText,
      intent: jevDecision.intent,
      intelligence: {
        provider: settings.llmProvider,
        system1Model: "jev-reflex-v3 (<3ms deterministic)",
        system2Model: `${settings.geminiModel} (${settings.thinkingMode.toUpperCase()})`,
        thinkingLevel: settings.thinkingMode,
      },
      engineMetrics: {
        system1Ms: jevDecision.latencyMs,
        system2Ms,
        totalMs,
        estTokens,
        energyEfficiencyScore: jevDecision.escalateToSystem2 ? 95 : 99,
      },
      jevDecision,
      steps,
      codeDiff,
      desktopEnvelope,
    };

    this.traces.unshift(trace);
    if (this.traces.length > 50) {
      this.traces = this.traces.slice(0, 50);
    }

    return {
      finalResponse,
      intent: jevDecision.intent,
      intentConfidence: jevDecision.confidence,
      agentOutput,
      sessionId,
      sources,
      jevDecision,
      trace,
      codeDiff,
      desktopEnvelope,
    };
  }
}
