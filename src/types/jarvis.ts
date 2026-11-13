export type Intent =
  | "chat"
  | "codex_diff"
  | "agent_desktop"
  | "nus_organizer"
  | "browser"
  | "mcp_tool"
  | "obsidian";

export type PillMood =
  | "idle"
  | "listening"
  | "reflex_zap"
  | "deep_thinking"
  | "acting_ref"
  | "speaking"
  | "celebrating"
  | "alert";

export type PipelineStateName =
  | "IDLE"
  | "TRANSCRIBING"
  | "JEV_REFLEX"
  | "THINKING"
  | "ACTING_REF"
  | "SPEAKING"
  | "ERROR";

export interface AccessibilityNode {
  ref: string;
  role:
    | "window"
    | "button"
    | "textfield"
    | "checkbox"
    | "tab"
    | "menuitem"
    | "codeeditor"
    | "listitem"
    | "status";
  name: string;
  value?: string;
  description?: string;
  enabled: boolean;
  focused: boolean;
  windowId: string;
  bounds: { x: number; y: number; width: number; height: number };
  children?: AccessibilityNode[];
}

export interface SandboxAppState {
  activeWindowId: "win-codex-runner" | "win-nus-planner" | "win-browser-preview";
  lastFocusedRef: string;
  terminalInput: string;
  terminalLastOutput: string;
  testSuitePassed: boolean;
  buildTarget: "development" | "production";
  autoDeployEnabled: boolean;
  quickNoteTitle: string;
  quickNoteBody: string;
  searchFilter: string;
  localBridgeConnected: boolean;
  localBridgeHost: string;
  actionHistory: Array<{
    id: string;
    timestamp: string;
    command: string;
    ref?: string;
    value?: string;
    summary: string;
  }>;
}

export interface AgentDesktopEnvelope {
  ok: boolean;
  mode: "web_sandbox" | "local_cli_bridge";
  command: string;
  targetRef?: string;
  summary: string;
  timestamp: string;
  activeWindowId: string;
  highlightedRef?: string;
  snapshot?: AccessibilityNode[];
}

export interface JevReflexDecision {
  reflexId: string;
  latencyMs: number;
  intent: Intent;
  confidence: number;
  pillMood: PillMood;
  instantAck: string;
  refinedTask: string;
  escalateToSystem2: boolean;
  refCommands?: Array<{
    command: "snapshot" | "click" | "type" | "press" | "focus";
    ref?: string;
    text?: string;
    key?: string;
  }>;
}

export interface CodexDiffPatch {
  id: string;
  filePath: string;
  title: string;
  language: string;
  before: string;
  after: string;
  unifiedDiff: string;
  additions: number;
  deletions: number;
  applied: boolean;
  timestamp: string;
}

export interface TraceStep {
  id: string;
  phase:
    | "jev_reflex"
    | "thought"
    | "tool_call"
    | "agent_desktop"
    | "diff_generated"
    | "synthesis";
  title: string;
  command?: string;
  detail: string;
  durationMs: number;
  status: "running" | "done" | "error";
}

export interface OpenJarvisTrace {
  traceId: string;
  timestamp: string;
  userPrompt: string;
  intent: Intent;
  intelligence: {
    provider: string;
    system1Model: string;
    system2Model: string;
    thinkingLevel: string;
  };
  engineMetrics: {
    system1Ms: number;
    system2Ms: number;
    totalMs: number;
    estTokens: number;
    energyEfficiencyScore: number;
  };
  jevDecision: JevReflexDecision;
  steps: TraceStep[];
  codeDiff?: CodexDiffPatch | null;
  desktopEnvelope?: AgentDesktopEnvelope | null;
}

export interface NusMilestone {
  id: string;
  title: string;
  courseOrProject: string;
  dueDate: string;
  priority: "high" | "medium" | "low";
  status: "todo" | "in_progress" | "done";
  notes?: string;
}

export interface TerminalLogEntry {
  id: string;
  timestamp: string;
  subsystem:
    | "JEV-SYS1"
    | "OPENJARVIS-SYS2"
    | "AGENT-DESKTOP"
    | "CODEX-DIFF"
    | "NUS-COMPANION"
    | "MCP";
  command: string;
  output: string;
  status: "ok" | "warn" | "error";
}

export interface VaultNoteItem {
  name: string;
  stem: string;
  preview: string;
  content?: string;
  tags?: string[];
  links?: string[];
  backlinks?: string[];
  folder?: string;
  updatedAt: string;
}

export interface SourceLink {
  title: string;
  uri: string;
}

export interface CodexThreadMessage {
  id: string;
  role: "user" | "jarvis";
  text: string;
  timestamp: string;
  intent?: Intent;
  roundTripMs?: number;
  sources?: SourceLink[];
  jevDecision?: JevReflexDecision;
  trace?: OpenJarvisTrace;
  codeDiff?: CodexDiffPatch | null;
  desktopEnvelope?: AgentDesktopEnvelope | null;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastIntent: Intent | string | null;
  turnCount: number;
  preview: string;
}
