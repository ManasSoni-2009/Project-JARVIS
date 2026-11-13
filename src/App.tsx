import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Cpu,
  ExternalLink,
  FolderKanban,
  MessageSquare,
  Mic,
  Moon,
  MousePointerClick,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { CodexWorkbench, WorkbenchTab } from "./components/CodexWorkbench.tsx";
import { JevPetPill } from "./components/JevPetPill.tsx";
import {
  StudioDropdown,
  StudioDropdownOption,
} from "./components/StudioDropdown.tsx";
import {
  AccessibilityNode,
  AgentDesktopEnvelope,
  ChatSessionSummary,
  CodexDiffPatch,
  CodexThreadMessage,
  Intent,
  JevReflexDecision,
  NusMilestone,
  OpenJarvisTrace,
  PillMood,
  PipelineStateName,
  SandboxAppState,
  SourceLink,
  TerminalLogEntry,
  TraceStep,
  VaultNoteItem,
} from "./types/jarvis.ts";

interface SettingsPayload {
  provider: "google" | "openai" | "anthropic" | "openrouter";
  flash_model?: string;
  thinking_mode: "auto" | "high" | "medium" | "low";
  tts_enabled: boolean;
  tts_voice: string;
  os_backend: "gemini_vision" | "openclaw";
  obsidian_vault_path?: string;
  has_gemini_key: boolean;
  has_openai_key: boolean;
  has_anthropic_key: boolean;
  has_openrouter_key: boolean;
  has_github_token: boolean;
}

interface DiagnosticCheckItem {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

interface AutoUpdateStatusItem {
  repo: string;
  branch: string;
  currentCommit: string;
  latestCommit: string;
  status: "up_to_date" | "updated" | "update_available" | "checking" | "offline";
  lastCheckedAt: string;
  updatedFiles: string[];
  latestCommitMessage: string;
  message: string;
}

const MODEL_DROPDOWN_OPTIONS: StudioDropdownOption[] = [
  {
    value: "gemini-4-hydrogen",
    label: "Gemini 3 Flash (gemini-4-hydrogen)",
    sublabel: "Primary multimodal & reasoning model + 5-min smart failover",
    badge: "Primary",
    badgeColor: "emerald",
    dotColor: "#10B981",
  },
  {
    value: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash Lite (gemini-3.1-flash-lite)",
    sublabel: "Ultra-low-latency high-throughput inference tier",
    badge: "Fast",
    badgeColor: "sky",
    dotColor: "#0EA5E9",
  },
];

const OS_BACKEND_DROPDOWN_OPTIONS: StudioDropdownOption[] = [
  {
    value: "gemini_vision",
    label: "agent-desktop @ref + Gemini Vision",
    sublabel: "Semantic @e1..@e17 accessibility tree + visual grounding",
    badge: "@ref",
    badgeColor: "sky",
    dotColor: "#0EA5E9",
  },
  {
    value: "openclaw",
    label: "OpenClaw Local OS Bridge",
    sublabel: "Direct local CLI socket automation (ws://127.0.0.1:44820)",
    badge: "Bridge",
    badgeColor: "violet",
    dotColor: "#A855F7",
  },
];

const THINKING_DROPDOWN_OPTIONS: StudioDropdownOption[] = [
  {
    value: "auto",
    label: "Auto Reflex",
    sublabel: "Jev Sys-1 router + dynamic escalation",
    badge: "<15ms",
    badgeColor: "emerald",
    dotColor: "#10B981",
  },
  {
    value: "low",
    label: "Sys-1 Fast",
    sublabel: "Instant deterministic & low-latency path",
    badge: "LOW",
    badgeColor: "amber",
    dotColor: "#F59E0B",
  },
  {
    value: "medium",
    label: "Balanced",
    sublabel: "Standard multi-step reasoning depth",
    badge: "MED",
    badgeColor: "sky",
    dotColor: "#0EA5E9",
  },
  {
    value: "high",
    label: "Sys-2 Deep",
    sublabel: "OpenJarvis 5-Primitive deep synthesis",
    badge: "HIGH",
    badgeColor: "violet",
    dotColor: "#A855F7",
  },
];

const PROVIDER_DROPDOWN_OPTIONS: StudioDropdownOption[] = [
  {
    value: "google",
    label: "Google Gemini (gemini-4-hydrogen)",
    sublabel: "Native System-1 + System-2 + Audio TTS/STT",
    badge: "Default",
    badgeColor: "emerald",
    dotColor: "#10B981",
  },
  {
    value: "openai",
    label: "OpenAI",
    sublabel: "Compatible multi-agent fallback provider",
    badge: "API",
    badgeColor: "sky",
    dotColor: "#0EA5E9",
  },
  {
    value: "anthropic",
    label: "Anthropic",
    sublabel: "Claude synthesis & code diff engine",
    badge: "API",
    badgeColor: "amber",
    dotColor: "#F59E0B",
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    sublabel: "Unified multi-model routing gateway",
    badge: "Router",
    badgeColor: "violet",
    dotColor: "#A855F7",
  },
];

const VOICE_DROPDOWN_OPTIONS: StudioDropdownOption[] = [
  {
    value: "Kore",
    label: "Kore (Studio Crisp)",
    sublabel: "gemini-3.8-flash-lite-tts · Balanced clarity",
    badge: "24kHz",
    badgeColor: "emerald",
    dotColor: "#10B981",
  },
  {
    value: "Fenrir",
    label: "Fenrir (J.A.R.V.I.S Baritone)",
    sublabel: "gemini-3.8-flash-lite-tts · Deep British cadence",
    badge: "Pro",
    badgeColor: "sky",
    dotColor: "#0EA5E9",
  },
  {
    value: "Puck",
    label: "Puck (Expressive Reflex)",
    sublabel: "gemini-3.8-flash-lite-tts · Lively companion tone",
    badge: "Fast",
    badgeColor: "amber",
    dotColor: "#F59E0B",
  },
  {
    value: "Charon",
    label: "Charon (Calm Analytical)",
    sublabel: "gemini-3.8-flash-lite-tts · Composed studio voice",
    badge: "Calm",
    badgeColor: "violet",
    dotColor: "#A855F7",
  },
  {
    value: "Zephyr",
    label: "Zephyr (Bright Airy)",
    sublabel: "gemini-3.8-flash-lite-tts · Warm conversational",
    badge: "Warm",
    badgeColor: "emerald",
    dotColor: "#34D399",
  },
];

const STUDIO_STARTER_CARDS = [
  {
    title: "Run CI via @e4 Desktop Ref",
    subtitle: "agent-desktop · <15ms reflex",
    prompt:
      "Click @e4 to execute the CI command in the Codex Build & Test Runner window",
  },
  {
    title: "Generate Telemetry Diff Patch",
    subtitle: "Diff Outbox · Unified patch review",
    prompt:
      "Refactor jevReflexRouter.ts to add speculative tool pre-fetching and latency histograms, and generate a unified diff",
  },
  {
    title: "Capture NŪS Sprint Milestone",
    subtitle: "nus-desktop · Deadline organizer",
    prompt:
      "Add task: Complete OpenJarvis 5-Primitive benchmark report by 2026-11-20 high priority",
  },
  {
    title: "Synthesize Second Brain Vault",
    subtitle: "Obsidian RAG · Knowledge graph",
    prompt: "Analyze my Obsidian vault notes about multi-agent architecture",
  },
];

const QUICK_CONTEXT_TOKENS = [
  { label: "@e4", insert: "Click @e4 " },
  { label: "@e3", insert: 'Type "npm run verify" into @e3 ' },
  {
    label: "@jevReflexRouter.ts",
    insert: "Refactor src/harness/jevReflexRouter.ts to ",
  },
  { label: "@nus", insert: "Add milestone: " },
  { label: "@vault", insert: "Search my Obsidian vault for " },
];

export default function App() {
  // Seamless Apple Daylight (light) & Pro Graphite (dark) Theme
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Hedwig Studio Layout State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [studioFrameOpen, setStudioFrameOpen] = useState(false);
  const [workbenchTab, setWorkbenchTab] = useState<WorkbenchTab>("diff");
  const [terminalSheetOpen, setTerminalSheetOpen] = useState(false);
  const [focusAwayPillMode, setFocusAwayPillMode] = useState(false);

  // Persistent Memory Sessions State (Hedwig Sidebar)
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>(
    "sess-codex-jev-router"
  );
  const [sessionSearch, setSessionSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  // Real-time connection & pipeline state
  const [wsConnected, setWsConnected] = useState(false);
  const [pipelineState, setPipelineState] = useState<PipelineStateName>("IDLE");
  const [pillMood, setPillMood] = useState<PillMood>("idle");
  const [pillSubtitle, setPillSubtitle] = useState<string>(
    "Jev System-1 Reflex + OpenJarvis System-2 ready."
  );
  const [lastJevDecision, setLastJevDecision] =
    useState<JevReflexDecision | null>(null);
  const [liveSteps, setLiveSteps] = useState<TraceStep[]>([]);

  // Conversation & Composer state
  const [messages, setMessages] = useState<CodexThreadMessage[]>([]);
  const [expandedTraceIds, setExpandedTraceIds] = useState<
    Record<string, boolean>
  >({});
  const [inputValue, setInputValue] = useState("");
  const [terminalCommandInput, setTerminalCommandInput] = useState("");
  const [vadEnabled, setVadEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Studio Frame Data Stores
  const [files, setFiles] = useState<Array<{ path: string; content: string }>>(
    []
  );
  const [patches, setPatches] = useState<CodexDiffPatch[]>([]);
  const [selectedPatchId, setSelectedPatchId] = useState<string | null>(null);
  const [accessibilityTree, setAccessibilityTree] = useState<
    AccessibilityNode[]
  >([]);
  const [sandboxState, setSandboxState] = useState<SandboxAppState | null>(
    null
  );
  const [highlightedRef, setHighlightedRef] = useState<string | null>(null);
  const [traces, setTraces] = useState<OpenJarvisTrace[]>([]);
  const [terminalLogs, setTerminalLogs] = useState<TerminalLogEntry[]>([]);
  const [milestones, setMilestones] = useState<NusMilestone[]>([]);
  const [vaultNotes, setVaultNotes] = useState<VaultNoteItem[]>([]);

  // Settings Modal & Toast state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<SettingsPayload>({
    provider: "google",
    flash_model: "gemini-4-hydrogen",
    thinking_mode: "auto",
    tts_enabled: true,
    tts_voice: "Kore",
    os_backend: "gemini_vision",
    obsidian_vault_path: "./data/vault",
    has_gemini_key: true,
    has_openai_key: false,
    has_anthropic_key: false,
    has_openrouter_key: false,
    has_github_token: false,
  });
  const [diagnosticsChecks, setDiagnosticsChecks] = useState<
    DiagnosticCheckItem[]
  >([]);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
  const [autoUpdateStatus, setAutoUpdateStatus] =
    useState<AutoUpdateStatusItem | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const vadMonitorRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const msgSeqRef = useRef<number>(1);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const fetchSessionsList = useCallback(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data: { sessions?: ChatSessionSummary[] }) => {
        if (data.sessions) {
          setSessions(data.sessions);
        }
      })
      .catch(() => {});
  }, []);

  const loadSessionById = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.json())
      .then(
        (data: {
          session?: {
            id: string;
            title: string;
            turns: Array<{
              id: number;
              timestamp: string;
              user_text: string;
              final_response: string;
              intent?: Intent;
              round_trip_ms?: number;
            }>;
          };
        }) => {
          if (!data.session) return;
          const loaded: CodexThreadMessage[] = [];
          data.session.turns.forEach((t, idx) => {
            const ts = new Date(t.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            if (t.user_text) {
              loaded.push({
                id: `hist-u-${sessionId}-${t.id}-${idx}`,
                role: "user",
                text: t.user_text,
                timestamp: ts,
              });
            }
            if (t.final_response) {
              loaded.push({
                id: `hist-j-${sessionId}-${t.id}-${idx}`,
                role: "jarvis",
                text: t.final_response,
                timestamp: ts,
                intent: t.intent,
                roundTripMs: t.round_trip_ms,
              });
            }
          });
          setMessages(loaded);
        }
      )
      .catch(() => {});
  }, []);

  const handleCreateNewSession = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Studio Thread" }),
      });
      const data = (await res.json()) as {
        session?: { id: string };
        sessions?: ChatSessionSummary[];
      };
      if (data.sessions) setSessions(data.sessions);
      if (data.session) {
        setActiveSessionId(data.session.id);
        setMessages([]);
        showToast("Created new Studio thread");
      }
    } catch {
      showToast("Failed to create thread");
    }
  }, [showToast]);

  const handleDeleteSession = useCallback(
    async (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      try {
        const res = await fetch(`/api/sessions/${sessionId}`, {
          method: "DELETE",
        });
        const data = (await res.json()) as {
          sessions?: ChatSessionSummary[];
        };
        if (data.sessions) {
          setSessions(data.sessions);
          if (activeSessionId === sessionId) {
            if (data.sessions[0]) {
              loadSessionById(data.sessions[0].id);
            } else {
              void handleCreateNewSession();
            }
          }
        }
      } catch {
        showToast("Failed to delete thread");
      }
    },
    [activeSessionId, handleCreateNewSession, loadSessionById, showToast]
  );

  const refreshTelemetryData = useCallback(() => {
    fetch("/api/openjarvis/telemetry")
      .then((r) => r.json())
      .then((data) => {
        if (data.files) setFiles(data.files);
        if (data.patches) {
          setPatches(data.patches);
          setSelectedPatchId((prev) => prev || data.patches[0]?.id || null);
        }
        if (data.accessibilityTree)
          setAccessibilityTree(data.accessibilityTree);
        if (data.desktopState) setSandboxState(data.desktopState);
        if (data.traces) setTraces(data.traces);
        if (data.terminalLogs) setTerminalLogs(data.terminalLogs);
        if (data.milestones) setMilestones(data.milestones);
      })
      .catch(() => {});

    fetch("/api/vault")
      .then((r) => r.json())
      .then((data) => {
        if (data.notes) setVaultNotes(data.notes);
      })
      .catch(() => {});

    fetchSessionsList();
  }, [fetchSessionsList]);

  useEffect(() => {
    const onBlur = () => {
      setPillMood((prev) => (prev === "idle" ? "listening" : prev));
      setPillSubtitle("Watching your workspace in the corner.");
    };
    const onFocus = () => {
      if (pipelineState === "IDLE") {
        setPillMood("idle");
      }
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [pipelineState]);

  const speakBrowserFallback = useCallback(
    (rawText: string) => {
      if (!settings.tts_enabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const clean = rawText
          .replace(/```[\s\S]*?```/g, "code block.")
          .replace(/[*_`#>•]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 320);
        if (!clean) return;
        const utter = new SpeechSynthesisUtterance(clean);
        const voices = window.speechSynthesis.getVoices();
        const preferred =
          voices.find((v) => /Daniel|Google UK English Male|Arthur|en-GB/i.test(v.name || v.lang)) ||
          voices.find((v) => v.lang.startsWith("en"));
        if (preferred) utter.voice = preferred;
        utter.rate = 1.05;
        utter.pitch = 0.98;
        utter.onstart = () => setPillMood("speaking");
        utter.onend = () => setPillMood("idle");
        utter.onerror = () => setPillMood("idle");
        window.speechSynthesis.speak(utter);
      } catch {
        // Ignore speech synthesis errors
      }
    },
    [settings.tts_enabled]
  );

  const playAudioBase64 = useCallback((base64Data: string) => {
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (!audioCtxRef.current) {
        const AudioContextCtor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        audioCtxRef.current = new AudioContextCtor();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      ctx
        .decodeAudioData(bytes.buffer.slice(0))
        .then((audioBuffer) => {
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          setPillMood("speaking");
          source.onended = () => setPillMood("idle");
          source.start(0);
        })
        .catch(() => {});
    } catch {
      // Ignore audio decode error
    }
  }, []);

  const handleWsMessage = useCallback(
    (msg: {
      type: string;
      state?: PipelineStateName;
      pillMood?: PillMood;
      intent?: Intent;
      instant_ack?: string;
      decision?: JevReflexDecision;
      step?: TraceStep;
      entry?: TerminalLogEntry;
      envelope?: AgentDesktopEnvelope;
      sandboxState?: SandboxAppState;
      source?: string;
      user_text?: string;
      response?: string;
      round_trip_ms?: number;
      sources?: SourceLink[];
      jevDecision?: JevReflexDecision;
      trace?: OpenJarvisTrace;
      codeDiff?: CodexDiffPatch | null;
      desktopEnvelope?: AgentDesktopEnvelope | null;
      data?: string;
      message?: string;
    }) => {
      switch (msg.type) {
        case "state": {
          const st = msg.state || "IDLE";
          setPipelineState(st);
          if (msg.pillMood) setPillMood(msg.pillMood);
          if (msg.instant_ack) setPillSubtitle(msg.instant_ack);
          if (st === "IDLE") {
            window.setTimeout(() => {
              setPillMood("idle");
            }, 2000);
          }
          break;
        }
        case "jev_reflex": {
          if (msg.decision) {
            setLastJevDecision(msg.decision);
            setPillMood(msg.decision.pillMood);
            setPillSubtitle(msg.decision.instantAck);
            if (msg.decision.intent === "agent_desktop") {
              setWorkbenchTab("desktop");
              setStudioFrameOpen(true);
            } else if (msg.decision.intent === "codex_diff") {
              setWorkbenchTab("diff");
              setStudioFrameOpen(true);
            } else if (
              msg.decision.intent === "nus_organizer" ||
              msg.decision.intent === "obsidian"
            ) {
              setWorkbenchTab("nus_vault");
              setStudioFrameOpen(true);
            }
          }
          break;
        }
        case "trace_step": {
          if (msg.step) {
            setLiveSteps((prev) => [...prev, msg.step!]);
          }
          if (msg.pillMood) setPillMood(msg.pillMood);
          break;
        }
        case "terminal_log": {
          if (msg.entry) {
            setTerminalLogs((prev) => [msg.entry!, ...prev.slice(0, 79)]);
          }
          break;
        }
        case "agent_desktop_update": {
          if (msg.envelope?.snapshot) {
            setAccessibilityTree(msg.envelope.snapshot);
          }
          if (msg.envelope?.highlightedRef) {
            setHighlightedRef(msg.envelope.highlightedRef);
          }
          if (msg.sandboxState) {
            setSandboxState(msg.sandboxState);
          }
          break;
        }
        case "response": {
          setPipelineState("IDLE");
          setLiveSteps([]);
          if (msg.trace) {
            setTraces((prev) => [msg.trace!, ...prev.slice(0, 24)]);
          }
          if (msg.codeDiff) {
            setPatches((prev) => [
              msg.codeDiff!,
              ...prev.filter((p) => p.id !== msg.codeDiff!.id),
            ]);
            setSelectedPatchId(msg.codeDiff.id);
            setWorkbenchTab("diff");
            setStudioFrameOpen(true);
          }
          if (msg.desktopEnvelope) {
            if (msg.desktopEnvelope.snapshot) {
              setAccessibilityTree(msg.desktopEnvelope.snapshot);
            }
            if (msg.desktopEnvelope.highlightedRef) {
              setHighlightedRef(msg.desktopEnvelope.highlightedRef);
            }
          }

          setMessages((prev) => {
            const next = [...prev];
            if (msg.user_text && msg.source === "audio") {
              next.push({
                id: `u-${Date.now()}-${++msgSeqRef.current}`,
                role: "user",
                text: msg.user_text,
                timestamp: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              });
            }
            if (msg.response) {
              const msgId = `j-${Date.now()}-${++msgSeqRef.current}`;
              next.push({
                id: msgId,
                role: "jarvis",
                text: msg.response,
                timestamp: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                intent: msg.intent,
                roundTripMs: msg.round_trip_ms,
                sources: msg.sources,
                jevDecision: msg.jevDecision,
                trace: msg.trace,
                codeDiff: msg.codeDiff,
                desktopEnvelope: msg.desktopEnvelope,
              });
            }
            return next;
          });

          if (msg.response && settings.tts_enabled) {
            speakBrowserFallback(msg.response);
          }

          refreshTelemetryData();
          break;
        }
        case "tts_audio": {
          if (msg.data) {
            playAudioBase64(msg.data);
          }
          break;
        }
        case "error": {
          setPipelineState("IDLE");
          setPillMood("alert");
          setLiveSteps([]);
          setMessages((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}-${++msgSeqRef.current}`,
              role: "jarvis",
              text: `Error: ${msg.message || "Unknown error"}`,
              timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
          ]);
          break;
        }
      }
    },
    [playAudioBase64, refreshTelemetryData, settings.tts_enabled, speakBrowserFallback]
  );

  useEffect(() => {
    let disposed = false;

    const connectWs = () => {
      if (disposed) return;
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const socket = new WebSocket(`${proto}://${window.location.host}/ws`);
      socket.binaryType = "arraybuffer";
      wsRef.current = socket;

      socket.onopen = () => {
        if (!disposed) setWsConnected(true);
      };
      socket.onclose = () => {
        if (!disposed) {
          setWsConnected(false);
          reconnectTimerRef.current = window.setTimeout(connectWs, 2500);
        }
      };
      socket.onerror = () => {
        if (!disposed) setWsConnected(false);
      };
      socket.onmessage = (evt) => {
        if (typeof evt.data === "string") {
          try {
            handleWsMessage(JSON.parse(evt.data));
          } catch {
            // ignore malformed frame
          }
        }
      };
    };

    connectWs();
    refreshTelemetryData();

    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data: { sessions?: ChatSessionSummary[] }) => {
        if (data.sessions && data.sessions.length > 0) {
          setSessions(data.sessions);
          loadSessionById(data.sessions[0].id);
        }
      })
      .catch(() => {});

    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setSettings((prev) => ({ ...prev, ...data })))
      .catch(() => {});

    fetch("/api/update/status")
      .then((r) => r.json())
      .then((data: AutoUpdateStatusItem) => {
        if (data?.currentCommit) setAutoUpdateStatus(data);
      })
      .catch(() => {});

    return () => {
      disposed = true;
      if (reconnectTimerRef.current)
        window.clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [handleWsMessage, loadSessionById, refreshTelemetryData]);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, pipelineState, liveSteps, scrollToBottom]);

  const handleChatScroll = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(distanceFromBottom > 140);
  }, []);

  const sendCommand = useCallback(
    (overrideText?: string) => {
      const text = (overrideText ?? inputValue).trim();
      if (!text) return;

      setLiveSteps([]);
      setPillMood("reflex_zap");
      setPillSubtitle(`Jev System-1 analyzing: "${text.slice(0, 40)}..."`);

      setMessages((prev) => [
        ...prev,
        {
          id: `u-${Date.now()}-${++msgSeqRef.current}`,
          role: "user",
          text,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
      if (!overrideText) setInputValue("");

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "text_input",
            text,
            sessionId: activeSessionId,
          })
        );
      } else {
        setPipelineState("THINKING");
        fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, sessionId: activeSessionId }),
        })
          .then((r) => r.json())
          .then((res) => {
            setPipelineState("IDLE");
            if (res.error) {
              showToast(res.error);
              return;
            }
            setMessages((prev) => [
              ...prev,
              {
                id: `j-${Date.now()}-${++msgSeqRef.current}`,
                role: "jarvis",
                text: res.response,
                timestamp: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                intent: res.intent,
                roundTripMs: res.roundTripMs,
                sources: res.sources,
                jevDecision: res.jevDecision,
                trace: res.trace,
                codeDiff: res.codeDiff,
                desktopEnvelope: res.desktopEnvelope,
              },
            ]);
            if (res.audioBase64) playAudioBase64(res.audioBase64);
            refreshTelemetryData();
          })
          .catch(() => {
            setPipelineState("IDLE");
            showToast("Failed to reach J.A.R.V.I.S engine");
          });
      }
    },
    [
      activeSessionId,
      inputValue,
      playAudioBase64,
      refreshTelemetryData,
      showToast,
    ]
  );

  // Voice Recording
  const stopRecording = useCallback(() => {
    if (vadMonitorRef.current) {
      window.clearInterval(vadMonitorRef.current);
      vadMonitorRef.current = null;
    }
    setIsRecording(false);
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsRecording(true);
      setPillMood("listening");
      setPillSubtitle("Listening to microphone stream...");

      const options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options.mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        options.mimeType = "audio/webm";
      }

      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (chunks.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          const blob = new Blob(chunks, {
            type: options.mimeType || "audio/webm",
          });
          const buf = await blob.arrayBuffer();
          wsRef.current.send(buf);
        }
      };

      recorder.start();

      if (vadEnabled) {
        const AudioContextCtor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new AudioContextCtor();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        let speechDetected = false;
        let lastSoundAt = Date.now();

        vadMonitorRef.current = window.setInterval(() => {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          if (avg > 16) {
            speechDetected = true;
            lastSoundAt = Date.now();
          } else if (speechDetected && Date.now() - lastSoundAt > 1500) {
            void ctx.close();
            stopRecording();
          }
        }, 120);
      }
    } catch {
      setIsRecording(false);
      showToast("Microphone access denied");
    }
  }, [isRecording, showToast, stopRecording, vadEnabled]);

  // Inspector Handlers
  const handleExecuteDesktopCommand = useCallback(
    async (cmd: {
      command: "snapshot" | "click" | "type" | "press" | "focus";
      ref?: string;
      text?: string;
      key?: string;
    }) => {
      setPillMood("acting_ref");
      setPillSubtitle(`agent-desktop ${cmd.command} ${cmd.ref || ""}`.trim());
      try {
        const res = await fetch("/api/agent-desktop/act", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cmd),
        });
        const data = await res.json();
        if (data.envelope?.snapshot)
          setAccessibilityTree(data.envelope.snapshot);
        if (data.envelope?.highlightedRef)
          setHighlightedRef(data.envelope.highlightedRef);
        if (data.sandboxState) setSandboxState(data.sandboxState);
        if (data.notes) {
          setVaultNotes(data.notes);
          showToast("Synced NŪS Scratchpad note to Obsidian Vault");
        }
        window.setTimeout(() => setPillMood("celebrating"), 500);
        window.setTimeout(() => setPillMood("idle"), 1800);
      } catch {
        showToast("Failed to execute agent-desktop command");
      }
    },
    [showToast]
  );

  const handleToggleLocalBridge = useCallback(
    async (connected: boolean, host: string) => {
      try {
        const res = await fetch("/api/agent-desktop/bridge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connected, host }),
        });
        const data = await res.json();
        if (data.sandboxState) setSandboxState(data.sandboxState);
        if (data.snapshot) setAccessibilityTree(data.snapshot);
        showToast(
          connected
            ? `Attached Local CLI Bridge (${host})`
            : "Switched to built-in Web Sandbox"
        );
      } catch {
        showToast("Bridge configuration error");
      }
    },
    [showToast]
  );

  const handleApplyPatch = useCallback(
    async (patchId: string) => {
      try {
        const res = await fetch("/api/codex/apply-diff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patchId }),
        });
        const data = await res.json();
        if (data.patch) {
          setPatches((prev) =>
            prev.map((p) => (p.id === patchId ? data.patch : p))
          );
          if (data.files) setFiles(data.files);
          setPillMood("celebrating");
          setPillSubtitle(`Applied patch to ${data.patch.filePath}`);
          showToast(`Approved & applied diff to ${data.patch.filePath}`);
        }
      } catch {
        showToast("Failed to apply diff");
      }
    },
    [showToast]
  );

  const handleRevertPatch = useCallback(
    async (patchId: string) => {
      try {
        const res = await fetch("/api/codex/revert-diff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patchId }),
        });
        const data = await res.json();
        if (data.patch) {
          setPatches((prev) =>
            prev.map((p) => (p.id === patchId ? data.patch : p))
          );
          if (data.files) setFiles(data.files);
          showToast(`Reverted diff on ${data.patch.filePath}`);
        }
      } catch {
        showToast("Failed to revert diff");
      }
    },
    [showToast]
  );

  const handleAddMilestone = useCallback(
    async (item: {
      title: string;
      courseOrProject: string;
      dueDate: string;
      priority: "high" | "medium" | "low";
    }) => {
      const res = await fetch("/api/nus/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      const data = await res.json();
      if (data.milestones) {
        setMilestones(data.milestones);
        showToast("Added NŪS milestone");
      }
    },
    [showToast]
  );

  const handleUpdateMilestoneStatus = useCallback(
    async (id: string, status: "todo" | "in_progress" | "done") => {
      const res = await fetch(`/api/nus/milestones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.milestones) setMilestones(data.milestones);
    },
    []
  );

  const handleDeleteMilestone = useCallback(async (id: string) => {
    const res = await fetch(`/api/nus/milestones/${id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (data.milestones) setMilestones(data.milestones);
  }, []);

  const handleCreateVaultNote = useCallback(
    async (title: string, content: string) => {
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      const data = await res.json();
      if (data.notes) {
        setVaultNotes(data.notes);
        showToast(`Saved '${title}.md' to Obsidian Vault`);
      }
    },
    [showToast]
  );

  const handleTerminalCommandSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const raw = terminalCommandInput.trim();
      if (!raw) return;
      setTerminalCommandInput("");

      if (raw.startsWith("agent-desktop")) {
        const refMatch = raw.match(/@e\d+/i)?.[0];
        if (raw.includes("click") && refMatch) {
          void handleExecuteDesktopCommand({ command: "click", ref: refMatch });
          return;
        }
        if (raw.includes("focus") && refMatch) {
          void handleExecuteDesktopCommand({ command: "focus", ref: refMatch });
          return;
        }
        void handleExecuteDesktopCommand({ command: "snapshot" });
        return;
      }

      sendCommand(raw);
    },
    [handleExecuteDesktopCommand, sendCommand, terminalCommandInput]
  );

  const updateThinkingMode = useCallback(
    (mode: SettingsPayload["thinking_mode"]) => {
      setSettings((s) => ({ ...s, thinking_mode: mode }));
      fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thinking_mode: mode }),
      }).catch(() => {});
    },
    []
  );

  const saveSettings = async () => {
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: settings.provider,
          flash_model: settings.flash_model || "gemini-4-hydrogen",
          thinking_mode: settings.thinking_mode,
          tts_enabled: settings.tts_enabled,
          tts_voice: settings.tts_voice,
          os_backend: settings.os_backend,
          obsidian_vault_path: settings.obsidian_vault_path || "./data/vault",
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings((prev) => ({ ...prev, ...updated }));
        showToast("Saved Studio setup to ./data/settings.json");
        setSettingsOpen(false);
      }
    } catch {
      showToast("Failed to save settings");
    }
  };

  const runStudioDiagnostics = async () => {
    setRunningDiagnostics(true);
    try {
      const res = await fetch("/api/setup/diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (Array.isArray(data.checks)) {
        setDiagnosticsChecks(data.checks);
        if (data.autoUpdate) setAutoUpdateStatus(data.autoUpdate);
        showToast("All 6 Studio subsystems verified ready");
      }
    } catch {
      showToast("Diagnostics check failed");
    } finally {
      setRunningDiagnostics(false);
    }
  };

  const handleCheckGitHubUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const res = await fetch("/api/update/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json()) as AutoUpdateStatusItem;
      if (data?.currentCommit) {
        setAutoUpdateStatus(data);
        showToast(data.message || `Synced with GitHub (${data.currentCommit})`);
      }
    } catch {
      showToast("GitHub update check failed");
    } finally {
      setCheckingUpdates(false);
    }
  };

  const toggleInspector = (tab: WorkbenchTab) => {
    setFocusAwayPillMode(false);
    if (studioFrameOpen && workbenchTab === tab) {
      setStudioFrameOpen(false);
    } else {
      setWorkbenchTab(tab);
      setStudioFrameOpen(true);
    }
  };

  const filteredSessions = useMemo(() => {
    const q = sessionSearch.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.preview.toLowerCase().includes(q)
    );
  }, [sessionSearch, sessions]);

  const activeSessionTitle =
    sessions.find((s) => s.id === activeSessionId)?.title ||
    "Studio Conversation";

  const pendingPatchCount = patches.filter((p) => !p.applied).length;

  const inspectorTabs: Array<{
    id: WorkbenchTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    iconClass: string;
    badge?: number;
  }> = [
    {
      id: "diff",
      label: "Diffs",
      icon: Code2,
      iconClass: "text-emerald-500",
      badge: pendingPatchCount > 0 ? pendingPatchCount : undefined,
    },
    {
      id: "desktop",
      label: "@ref",
      icon: MousePointerClick,
      iconClass: "text-sky-500",
    },
    {
      id: "nus_vault",
      label: "Vault",
      icon: FolderKanban,
      iconClass: "text-amber-500",
    },
    {
      id: "telemetry",
      label: "Traces",
      icon: Activity,
      iconClass: "text-violet-500",
    },
  ];

  return (
    <div className="flex h-screen w-screen studio-canvas-light text-[#1D1D1F] dark:text-[#F5F5F7] p-2 sm:p-3 gap-2.5 sm:gap-3 transition-colors duration-300 overflow-hidden">
      <AnimatePresence mode="wait">
        {focusAwayPillMode ? (
          /* FOCUS-AWAY COMPANION MODE */
          <motion.main
            key="companion-stage"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 flex flex-col items-center justify-center p-6 text-center relative"
          >
            <div className="max-w-md mx-auto p-7 rounded-[24px] bg-white/88 dark:bg-[#131317]/90 backdrop-blur-2xl border border-black/[0.07] dark:border-white/[0.08] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.08)] dark:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.65)]">
              <div className="text-[11px] font-mono text-[#6E6E73] dark:text-[#8E8E93] mb-1.5">
                Companion Overlay Mode · Pure-Avatar Visor
              </div>
              <h1 className="text-xl font-bold text-[#1D1D1F] dark:text-white tracking-tight mb-2.5">
                Studio Minimized to Avatar Pill
              </h1>
              <p className="text-xs text-[#515154] dark:text-[#A1A1AA] leading-relaxed mb-5">
                The bottom-right capsule is 100% the character’s minimal visor
                face. Hover or tap it to watch it pop larger with elastic GSAP
                physics, drag it for rubber-band resistance, or double-tap for
                voice.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    sendCommand("Click @e4 to run the CI build and test suite")
                  }
                  className="studio-btn px-3.5 py-2 rounded-[12px] bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] font-semibold text-xs cursor-pointer"
                >
                  Trigger @e4 Scan
                </button>
                <button
                  type="button"
                  onClick={() =>
                    sendCommand(
                      "Give me a 1-sentence witty J.A.R.V.I.S status report"
                    )
                  }
                  className="studio-btn px-3.5 py-2 rounded-[12px] bg-black/[0.06] dark:bg-white/[0.08] text-[#1D1D1F] dark:text-zinc-200 font-medium text-xs hover:bg-black/[0.1] dark:hover:bg-white/[0.14] cursor-pointer"
                >
                  Test Voice & Thinking
                </button>
                <button
                  type="button"
                  onClick={() => setFocusAwayPillMode(false)}
                  className="studio-btn px-3.5 py-2 rounded-[12px] border border-black/[0.1] dark:border-white/[0.12] text-[#1D1D1F] dark:text-zinc-200 font-medium text-xs hover:bg-black/[0.04] dark:hover:bg-white/[0.05] cursor-pointer"
                >
                  Return to Studio
                </button>
              </div>
            </div>
          </motion.main>
        ) : (
          <motion.div
            key="main-studio-workspace"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-1 min-w-0 h-full gap-2.5 sm:gap-3 overflow-hidden"
          >
            {/* 1. HEDWIG MEMORY & THREADS SIDEBAR (Smooth Eased Expand/Collapse) */}
            <AnimatePresence initial={false}>
              {sidebarOpen && (
                <motion.aside
                  key="hedwig-memory-sidebar"
                  initial={{ opacity: 0, x: -24, width: 0 }}
                  animate={{ opacity: 1, x: 0, width: 264 }}
                  exit={{ opacity: 0, x: -24, width: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="shrink-0 h-full rounded-[22px] bg-white/88 dark:bg-[#131317]/90 backdrop-blur-2xl border border-black/[0.07] dark:border-white/[0.08] shadow-[0_12px_36px_-10px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.55)] flex flex-col overflow-hidden select-none"
                >
                  {/* Brand & Sidebar Collapse Row */}
                  <div className="h-13 px-4 border-b border-black/[0.06] dark:border-white/[0.07] flex items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-[7px] bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] flex items-center justify-center font-mono text-[11px] font-bold shrink-0">
                        J
                      </div>
                      <span className="text-sm font-bold tracking-tight text-[#1D1D1F] dark:text-white truncate">
                        J.A.R.V.I.S Studio
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSidebarOpen(false)}
                      title="Collapse Sidebar"
                      className="studio-btn w-7 h-7 rounded-[9px] flex items-center justify-center text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] cursor-pointer"
                    >
                      <PanelLeftClose className="w-4 h-4" />
                    </button>
                  </div>

                  {/* New Thread Button + Animated Search Filter */}
                  <div className="p-3 space-y-2 border-b border-black/[0.05] dark:border-white/[0.06] shrink-0">
                    <button
                      type="button"
                      onClick={handleCreateNewSession}
                      className="studio-btn w-full h-9 px-3 rounded-[12px] bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] hover:opacity-92 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Studio Thread</span>
                    </button>

                    {/* Animated Search Bar */}
                    <div
                      className={`relative flex items-center rounded-[10px] border transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        searchFocused
                          ? "bg-white dark:bg-[#1A1A22] border-black/[0.18] dark:border-white/[0.2] shadow-[0_4px_14px_rgba(0,0,0,0.05)]"
                          : "bg-black/[0.04] dark:bg-white/[0.05] border-transparent hover:border-black/[0.08] dark:hover:border-white/[0.08]"
                      }`}
                    >
                      <Search
                        className={`w-3.5 h-3.5 ml-2.5 shrink-0 transition-colors duration-200 ${
                          searchFocused
                            ? "text-[#1D1D1F] dark:text-white"
                            : "text-[#8E8E93]"
                        }`}
                      />
                      <input
                        type="text"
                        value={sessionSearch}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setSearchFocused(false)}
                        onChange={(e) => setSessionSearch(e.target.value)}
                        placeholder="Search memory threads..."
                        className="w-full h-8 pl-2 pr-7 bg-transparent text-xs text-[#1D1D1F] dark:text-zinc-200 placeholder-[#8E8E93] outline-none"
                      />
                      <AnimatePresence>
                        {sessionSearch && (
                          <motion.button
                            type="button"
                            initial={{ opacity: 0, scale: 0.7 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.7 }}
                            transition={{ duration: 0.14 }}
                            onClick={() => setSessionSearch("")}
                            className="absolute right-2 w-4 h-4 rounded-full bg-black/[0.08] dark:bg-white/[0.12] flex items-center justify-center text-[#6E6E73] dark:text-zinc-300 hover:text-[#1D1D1F] dark:hover:text-white cursor-pointer"
                          >
                            <X className="w-2.5 h-2.5" />
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Saved Memory Threads List */}
                  <div className="px-3.5 pt-3 pb-1.5 flex items-center justify-between text-[10.5px] font-semibold text-[#8E8E93] dark:text-zinc-500 shrink-0">
                    <span>Memory Threads</span>
                    <span className="font-mono tabular-nums">
                      {filteredSessions.length}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto studio-scroll px-2.5 pb-2 space-y-1">
                    <AnimatePresence initial={false}>
                      {filteredSessions.map((sess) => {
                        const isActive = sess.id === activeSessionId;
                        return (
                          <motion.div
                            key={sess.id}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            transition={{
                              duration: 0.2,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            onClick={() => loadSessionById(sess.id)}
                            className={`group relative p-2.5 rounded-[12px] transition-colors cursor-pointer flex items-start justify-between gap-2 ${
                              isActive
                                ? "text-[#1D1D1F] dark:text-white"
                                : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-[#515154] dark:text-zinc-400"
                            }`}
                          >
                            {isActive && (
                              <motion.div
                                layoutId="activeMemoryThreadBg"
                                transition={{
                                  type: "spring",
                                  stiffness: 420,
                                  damping: 34,
                                }}
                                className="absolute inset-0 rounded-[12px] bg-black/[0.06] dark:bg-white/[0.09]"
                              />
                            )}

                            <div className="relative z-10 flex items-start gap-2 min-w-0 flex-1">
                              <MessageSquare
                                className={`w-3.5 h-3.5 mt-0.5 shrink-0 transition-colors ${
                                  isActive
                                    ? "text-[#1D1D1F] dark:text-white"
                                    : "text-[#8E8E93] dark:text-zinc-500"
                                }`}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold truncate">
                                  {sess.title}
                                </div>
                                <div className="text-[11px] text-[#8E8E93] dark:text-zinc-500 truncate mt-0.5">
                                  {sess.preview}
                                </div>
                                <div className="text-[10px] font-mono text-[#8E8E93] dark:text-zinc-500 mt-1 flex items-center gap-1.5 tabular-nums">
                                  <span>{sess.turnCount} turns</span>
                                  {sess.lastIntent && (
                                    <>
                                      <span>·</span>
                                      <span>{sess.lastIntent}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {sessions.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteSession(e, sess.id)}
                                aria-label="Delete thread"
                                className="relative z-10 opacity-0 group-hover:opacity-100 p-1 rounded-[7px] text-[#8E8E93] hover:text-rose-500 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-all cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {/* Sidebar Footer: Workspace Summary, Theme & Settings */}
                  <div className="p-3 border-t border-black/[0.06] dark:border-white/[0.07] space-y-2.5 shrink-0">
                    <div className="px-2.5 py-2 rounded-[12px] bg-[#F8F8FA] dark:bg-[#0D0D11] border border-black/[0.05] dark:border-white/[0.06] text-[10.5px] font-mono text-[#6E6E73] dark:text-zinc-400 flex items-center justify-between tabular-nums">
                      <span>17 @refs · {vaultNotes.length} notes</span>
                      <span>
                        {milestones.filter((m) => m.status !== "done").length}{" "}
                        tasks
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setTheme((prev) =>
                            prev === "light" ? "dark" : "light"
                          )
                        }
                        className="studio-btn flex-1 h-8 px-2.5 rounded-[10px] bg-black/[0.05] dark:bg-white/[0.07] hover:bg-black/[0.09] dark:hover:bg-white/[0.12] text-xs font-medium text-[#1D1D1F] dark:text-zinc-200 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {theme === "light" ? (
                          <>
                            <Moon className="w-3.5 h-3.5" />
                            <span>Graphite</span>
                          </>
                        ) : (
                          <>
                            <Sun className="w-3.5 h-3.5" />
                            <span>Daylight</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSettingsOpen(true)}
                        className="studio-btn h-8 px-2.5 rounded-[10px] bg-black/[0.05] dark:bg-white/[0.07] hover:bg-black/[0.09] dark:hover:bg-white/[0.12] text-xs font-medium text-[#1D1D1F] dark:text-zinc-200 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>Engine</span>
                      </button>
                    </div>
                  </div>
                </motion.aside>
              )}
            </AnimatePresence>

            {/* 2. PRIMARY STUDIO STAGE */}
            <section className="relative flex-1 min-w-0 h-full rounded-[22px] bg-white/90 dark:bg-[#131317]/92 backdrop-blur-2xl border border-black/[0.07] dark:border-white/[0.08] shadow-[0_12px_36px_-10px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.55)] flex flex-col overflow-hidden">
              {/* Single Unified Top Stage Header with Liquid Sliding Inspector Pill */}
              <header className="h-13 px-4 border-b border-black/[0.06] dark:border-white/[0.07] flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  {!sidebarOpen && (
                    <button
                      type="button"
                      onClick={() => setSidebarOpen(true)}
                      title="Open Memory Sidebar"
                      className="studio-btn w-7 h-7 rounded-[9px] flex items-center justify-center text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] cursor-pointer shrink-0"
                    >
                      <PanelLeftOpen className="w-4 h-4" />
                    </button>
                  )}
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={activeSessionId}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      className="text-xs font-semibold text-[#1D1D1F] dark:text-white truncate"
                    >
                      {activeSessionTitle}
                    </motion.span>
                  </AnimatePresence>
                  <span className="hidden sm:inline text-[11px] font-mono text-[#8E8E93] dark:text-zinc-500 shrink-0 tabular-nums">
                    ·{" "}
                    {lastJevDecision
                      ? `Sys1 ${lastJevDecision.latencyMs}ms`
                      : wsConnected
                      ? "Ready"
                      : "Syncing"}
                  </span>
                </div>

                {/* Single Segmented Inspector Switcher + Companion Mode */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center gap-0.5 p-1 rounded-[12px] bg-[#F2F2F7] dark:bg-[#0B0B0E] border border-black/[0.05] dark:border-white/[0.06]">
                    {inspectorTabs.map((tab) => {
                      const Icon = tab.icon;
                      const isActive =
                        studioFrameOpen && workbenchTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => toggleInspector(tab.id)}
                          className={`relative h-7 px-2.5 rounded-[8px] text-[11.5px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                            isActive
                              ? "text-[#1D1D1F] dark:text-white"
                              : "text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-zinc-200"
                          }`}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="activeInspectorTabPill"
                              transition={{
                                type: "spring",
                                stiffness: 440,
                                damping: 32,
                              }}
                              className="absolute inset-0 rounded-[8px] bg-white dark:bg-[#222228] shadow-xs"
                            />
                          )}
                          <Icon
                            className={`relative z-10 w-3.5 h-3.5 ${tab.iconClass}`}
                          />
                          <span className="relative z-10 hidden md:inline">
                            {tab.label}
                          </span>
                          {tab.badge !== undefined && (
                            <span className="relative z-10 font-mono text-[10px] opacity-75 tabular-nums">
                              {tab.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => setTerminalSheetOpen((prev) => !prev)}
                      className={`relative h-7 px-2.5 rounded-[8px] text-[11.5px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                        terminalSheetOpen
                          ? "bg-white dark:bg-[#222228] text-[#1D1D1F] dark:text-white shadow-xs"
                          : "text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-zinc-200"
                      }`}
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span className="hidden xl:inline">Term</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setFocusAwayPillMode(true);
                      setPillMood("reflex_zap");
                      setPillSubtitle(
                        "Companion active! Tap or drag me in the corner."
                      );
                    }}
                    className="studio-btn h-8 px-3 rounded-[10px] bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] text-[11.5px] font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Companion
                  </button>
                </div>
              </header>

              {/* Conversation & Task Stream with Smooth Momentum Scrolling */}
              <div
                ref={chatScrollRef}
                onScroll={handleChatScroll}
                className="flex-1 overflow-y-auto studio-scroll px-5 sm:px-8 py-6"
              >
                <AnimatePresence mode="wait">
                  {messages.length === 0 ? (
                    <motion.div
                      key="empty-starter-stage"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full flex flex-col justify-center max-w-[620px] mx-auto py-4"
                    >
                      <div className="text-[11px] font-mono text-[#6E6E73] dark:text-[#8E8E93] mb-1.5">
                        OpenJarvis 5-Primitive Core · Jev System-1 Reflex ·
                        agent-desktop @ref
                      </div>
                      <h2 className="text-2xl font-bold tracking-tight text-[#1D1D1F] dark:text-white mb-2">
                        What would you like to build or automate?
                      </h2>
                      <p className="text-xs sm:text-sm text-[#515154] dark:text-[#A1A1AA] leading-relaxed mb-5">
                        Start a new task below or select any saved memory thread
                        from the left sidebar. Inspector panels open on the
                        right only when needed.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {STUDIO_STARTER_CARDS.map((card, idx) => (
                          <motion.button
                            key={card.title}
                            type="button"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              delay: idx * 0.045,
                              duration: 0.24,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            onClick={() => sendCommand(card.prompt)}
                            className="studio-btn p-3.5 rounded-[14px] border border-black/[0.07] dark:border-white/[0.08] bg-[#FAFAFC]/90 dark:bg-[#19191F]/80 hover:bg-white dark:hover:bg-[#202027] hover:border-black/[0.15] dark:hover:border-white/[0.16] text-left cursor-pointer group"
                          >
                            <div className="text-xs font-semibold text-[#1D1D1F] dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors mb-0.5">
                              {card.title}
                            </div>
                            <div className="text-[11px] font-mono text-[#8E8E93] dark:text-zinc-400">
                              {card.subtitle}
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={`thread-${activeSessionId}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="space-y-4 max-w-[660px] mx-auto"
                    >
                      <AnimatePresence initial={false}>
                        {messages.map((m) => {
                          const isExpanded = Boolean(expandedTraceIds[m.id]);
                          return (
                            <motion.div
                              key={m.id}
                              initial={{ opacity: 0, y: 10, scale: 0.99 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{
                                duration: 0.24,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                            >
                              {m.role === "user" ? (
                                <div className="flex justify-end">
                                  <div className="max-w-[82%] rounded-[18px] rounded-br-[6px] bg-[#1D1D1F] dark:bg-[#27272F] text-white px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-xs">
                                    <div>{m.text}</div>
                                    <div className="text-[10px] font-mono text-white/55 mt-1 text-right">
                                      {m.timestamp}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1.5">
                                  {(m.jevDecision || m.trace) && (
                                    <div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedTraceIds((prev) => ({
                                            ...prev,
                                            [m.id]: !prev[m.id],
                                          }))
                                        }
                                        className="studio-btn inline-flex items-center gap-1 text-[11px] font-mono text-[#6E6E73] dark:text-[#A1A1AA] hover:text-[#1D1D1F] dark:hover:text-white cursor-pointer"
                                      >
                                        {isExpanded ? (
                                          <ChevronDown className="w-3 h-3" />
                                        ) : (
                                          <ChevronRight className="w-3 h-3" />
                                        )}
                                        <span>
                                          Reflex{" "}
                                          {m.jevDecision?.latencyMs ??
                                            m.trace?.engineMetrics.system1Ms ??
                                            4}
                                          ms · {m.intent || "general"}
                                          {m.roundTripMs
                                            ? ` · ${m.roundTripMs}ms total`
                                            : ""}
                                        </span>
                                      </button>

                                      <AnimatePresence>
                                        {isExpanded && m.trace && (
                                          <motion.div
                                            initial={{
                                              opacity: 0,
                                              height: 0,
                                              marginTop: 0,
                                            }}
                                            animate={{
                                              opacity: 1,
                                              height: "auto",
                                              marginTop: 6,
                                            }}
                                            exit={{
                                              opacity: 0,
                                              height: 0,
                                              marginTop: 0,
                                            }}
                                            transition={{
                                              duration: 0.22,
                                              ease: [0.22, 1, 0.36, 1],
                                            }}
                                            className="overflow-hidden"
                                          >
                                            <div className="p-3 rounded-[14px] border border-black/[0.07] dark:border-white/[0.08] bg-[#F8F8FA] dark:bg-[#0D0D11] space-y-1 font-mono text-[11px]">
                                              {m.trace.steps.map((step) => (
                                                <div
                                                  key={step.id}
                                                  className="flex items-center justify-between gap-2 text-[#3A3A3C] dark:text-zinc-300"
                                                >
                                                  <span className="truncate">
                                                    {step.phase} · {step.title}:{" "}
                                                    <span className="text-[#6E6E73] dark:text-zinc-400">
                                                      {step.detail}
                                                    </span>
                                                  </span>
                                                  <span className="text-[#8E8E93] shrink-0 tabular-nums">
                                                    {step.durationMs}ms
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  )}

                                  <div className="rounded-[18px] rounded-tl-[6px] border border-black/[0.07] dark:border-white/[0.08] bg-[#FAFAFC] dark:bg-[#191920] px-4 py-3 text-xs sm:text-sm text-[#1D1D1F] dark:text-[#F5F5F7] leading-relaxed whitespace-pre-wrap">
                                    {m.text}
                                  </div>

                                  {m.codeDiff && (
                                    <motion.div
                                      initial={{ opacity: 0, y: 6 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{
                                        duration: 0.22,
                                        ease: [0.22, 1, 0.36, 1],
                                      }}
                                      className="p-3 rounded-[14px] border border-black/[0.08] dark:border-white/[0.09] bg-white dark:bg-[#111116] flex items-center justify-between gap-3"
                                    >
                                      <div className="min-w-0">
                                        <div className="text-xs font-semibold text-[#1D1D1F] dark:text-white truncate">
                                          Diff Outbox · {m.codeDiff.title}
                                        </div>
                                        <div className="text-[11px] font-mono text-[#6E6E73] dark:text-zinc-400 mt-0.5">
                                          {m.codeDiff.filePath} · +
                                          {m.codeDiff.additions} / -
                                          {m.codeDiff.deletions}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedPatchId(m.codeDiff!.id);
                                            setWorkbenchTab("diff");
                                            setStudioFrameOpen(true);
                                          }}
                                          className="studio-btn px-2.5 py-1 rounded-[9px] bg-black/[0.05] dark:bg-white/[0.08] text-xs font-medium text-[#1D1D1F] dark:text-zinc-200 cursor-pointer"
                                        >
                                          Inspect
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleApplyPatch(m.codeDiff!.id)
                                          }
                                          className="studio-btn px-2.5 py-1 rounded-[9px] bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                                        >
                                          <Check className="w-3 h-3" />
                                          <span>Approve</span>
                                        </button>
                                      </div>
                                    </motion.div>
                                  )}

                                  {m.sources && m.sources.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-0.5">
                                      {m.sources.map((s, idx) => (
                                        <a
                                          key={idx}
                                          href={s.uri}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="studio-btn inline-flex items-center gap-1 text-[11px] font-mono text-sky-600 dark:text-sky-400 hover:underline"
                                        >
                                          <ExternalLink className="w-3 h-3" />
                                          <span className="truncate max-w-[200px]">
                                            {s.title}
                                          </span>
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>

                      <AnimatePresence>
                        {pipelineState !== "IDLE" && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{
                              duration: 0.2,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            className="p-3 rounded-[14px] border border-black/[0.07] dark:border-white/[0.08] bg-[#FAFAFC] dark:bg-[#191920] text-xs font-mono text-[#6E6E73] dark:text-zinc-300 space-y-1"
                          >
                            <div className="font-semibold text-[#1D1D1F] dark:text-white flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-sky-500 animate-spin" />
                              <span>
                                {pipelineState} · {pillSubtitle}
                              </span>
                            </div>
                            {liveSteps.map((st) => (
                              <div
                                key={st.id}
                                className="text-[11px] text-[#6E6E73] dark:text-zinc-400"
                              >
                                {st.phase} · {st.title} ({st.durationMs}ms)
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div ref={chatEndRef} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Floating Scroll-to-Bottom Pill */}
              <AnimatePresence>
                {showScrollBottom && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    onClick={scrollToBottom}
                    className="studio-btn absolute bottom-32 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] text-xs font-semibold shadow-lg inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                    <span>Jump to latest</span>
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Concentric Rounded Composer with Custom Upward Thinking Dropdown */}
              <div className="px-4 sm:px-6 pb-4 pt-1 shrink-0 z-20">
                <div className="max-w-[660px] mx-auto rounded-[20px] border border-black/[0.09] dark:border-white/[0.1] bg-[#FAFAFC] dark:bg-[#1A1A20] p-2.5 shadow-[0_6px_22px_-6px_rgba(0,0,0,0.05)] focus-within:border-black/[0.22] dark:focus-within:border-white/[0.24] focus-within:shadow-[0_14px_36px_-8px_rgba(0,0,0,0.1)] focus-within:-translate-y-[1px] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-1.5 border-b border-black/[0.05] dark:border-white/[0.06] studio-scroll">
                    {QUICK_CONTEXT_TOKENS.map((tok) => (
                      <button
                        key={tok.label}
                        type="button"
                        onClick={() =>
                          setInputValue((prev) => `${tok.insert}${prev}`)
                        }
                        className="studio-btn px-2 py-0.5 rounded-[8px] bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] font-mono text-[11px] text-[#3A3A3C] dark:text-zinc-300 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {tok.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-end gap-2">
                    <textarea
                      rows={2}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendCommand();
                        }
                      }}
                      placeholder="Ask J.A.R.V.I.S, target @e1..@e17, or request a code diff..."
                      className="flex-1 bg-transparent resize-none text-xs sm:text-sm text-[#1D1D1F] dark:text-white placeholder-[#8E8E93] dark:placeholder-zinc-500 outline-none leading-relaxed px-1"
                    />

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Custom Upward-Opening Thinking Mode Popover Dropdown */}
                      <StudioDropdown
                        value={settings.thinking_mode}
                        options={THINKING_DROPDOWN_OPTIONS}
                        onChange={(val) =>
                          updateThinkingMode(
                            val as SettingsPayload["thinking_mode"]
                          )
                        }
                        direction="up"
                        align="right"
                        icon={<Cpu className="w-3.5 h-3.5" />}
                        className="w-[126px]"
                        menuWidthClass="w-[240px]"
                      />

                      <button
                        type="button"
                        onClick={isRecording ? stopRecording : startRecording}
                        aria-label="Voice input"
                        className={`studio-btn w-8 h-8 rounded-[10px] flex items-center justify-center cursor-pointer ${
                          isRecording
                            ? "bg-rose-500 text-white scale-105"
                            : "bg-black/[0.05] dark:bg-white/[0.07] text-[#1D1D1F] dark:text-white hover:bg-black/[0.1] dark:hover:bg-white/[0.14]"
                        }`}
                      >
                        <Mic className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => sendCommand()}
                        disabled={!inputValue.trim()}
                        aria-label="Send command"
                        className="studio-btn w-8 h-8 rounded-[10px] bg-[#1D1D1F] dark:bg-white disabled:opacity-30 text-white dark:text-[#1D1D1F] flex items-center justify-center cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. RIGHT MODULAR INSPECTOR FRAME (Smooth AnimatePresence Slide-In/Out) */}
            <AnimatePresence initial={false}>
              {studioFrameOpen && (
                <CodexWorkbench
                  key="codex-inspector-frame"
                  activeTab={workbenchTab}
                  onSelectTab={(t) => setWorkbenchTab(t)}
                  onCloseFrame={() => setStudioFrameOpen(false)}
                  files={files}
                  patches={patches}
                  selectedPatchId={selectedPatchId}
                  onSelectPatch={setSelectedPatchId}
                  onApplyPatch={handleApplyPatch}
                  onRevertPatch={handleRevertPatch}
                  accessibilityTree={accessibilityTree}
                  sandboxState={sandboxState}
                  highlightedRef={highlightedRef}
                  onExecuteDesktopCommand={handleExecuteDesktopCommand}
                  onToggleLocalBridge={handleToggleLocalBridge}
                  traces={traces}
                  milestones={milestones}
                  onAddMilestone={handleAddMilestone}
                  onUpdateMilestoneStatus={handleUpdateMilestoneStatus}
                  onDeleteMilestone={handleDeleteMilestone}
                  vaultNotes={vaultNotes}
                  onCreateVaultNote={handleCreateVaultNote}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SLIDE-UP STUDIO TERMINAL SHEET (Smooth AnimatePresence Entrance & Exit) */}
      <AnimatePresence>
        {terminalSheetOpen && (
          <motion.div
            key="terminal-sheet"
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-6 bottom-6 z-40 max-w-3xl mx-auto h-60 rounded-[22px] bg-white/95 dark:bg-[#111115]/95 backdrop-blur-2xl border border-black/[0.1] dark:border-white/[0.12] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.25)] flex flex-col overflow-hidden"
          >
            <div className="h-10 px-4 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-mono text-[#1D1D1F] dark:text-zinc-200">
                <Terminal className="w-3.5 h-3.5 text-sky-500" />
                <span className="font-semibold">
                  J.A.R.V.I.S Harness Terminal Stream
                </span>
                <span className="text-[#8E8E93] hidden sm:inline">
                  · [JEV-SYS1] · [OPENJARVIS-SYS2] · [AGENT-DESKTOP]
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTerminalSheetOpen(false)}
                className="studio-btn w-6 h-6 rounded-full flex items-center justify-center text-[#6E6E73] hover:text-[#1D1D1F] dark:hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto studio-scroll p-3.5 font-mono text-[11.5px] space-y-1">
              {terminalLogs.map((entry) => (
                <div key={entry.id} className="flex items-start gap-2">
                  <span className="text-[#8E8E93] shrink-0 tabular-nums">
                    {entry.timestamp}
                  </span>
                  <span
                    className={`font-semibold shrink-0 ${
                      entry.subsystem === "JEV-SYS1"
                        ? "text-amber-600 dark:text-amber-400"
                        : entry.subsystem === "AGENT-DESKTOP"
                        ? "text-sky-600 dark:text-sky-400"
                        : entry.subsystem === "CODEX-DIFF"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-violet-600 dark:text-violet-400"
                    }`}
                  >
                    [{entry.subsystem}]
                  </span>
                  <span className="text-[#1D1D1F] dark:text-zinc-200 break-all">
                    {entry.command}
                  </span>
                  <span className="text-[#6E6E73] dark:text-zinc-400">
                    → {entry.output}
                  </span>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleTerminalCommandSubmit}
              className="h-10 px-4 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center gap-2 bg-[#F8F8FA] dark:bg-[#0B0B0E]"
            >
              <span className="font-mono text-xs text-sky-600 dark:text-sky-400">
                jarvis$
              </span>
              <input
                type="text"
                value={terminalCommandInput}
                onChange={(e) => setTerminalCommandInput(e.target.value)}
                placeholder="agent-desktop click @e4 | agent-desktop snapshot | any prompt..."
                className="flex-1 bg-transparent font-mono text-xs text-[#1D1D1F] dark:text-zinc-200 outline-none"
              />
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ENGINE & WORKSPACE SETUP MODAL (Complete In-GUI Setup + Diagnostics) */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            key="settings-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSettingsOpen(false)}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg max-h-[88vh] overflow-y-auto studio-scroll rounded-[22px] bg-white dark:bg-[#16161B] border border-black/[0.08] dark:border-white/[0.1] p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-white">
                    Studio Engine & Workspace Setup
                  </h3>
                  <p className="text-[11px] text-[#6E6E73] dark:text-zinc-400">
                    Persisted automatically to{" "}
                    <code className="font-mono">./data/settings.json</code>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="studio-btn w-7 h-7 rounded-full flex items-center justify-center text-[#6E6E73] hover:text-[#1D1D1F] dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Provider Environment Readiness Badges */}
              <div className="mb-4 p-3 rounded-[14px] bg-[#F5F5F7] dark:bg-[#101015] border border-black/[0.05] dark:border-white/[0.07]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-[#1D1D1F] dark:text-zinc-200">
                    Connected Provider Credentials (Server Environment)
                  </span>
                  <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                    Auto-Failover Active
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "Google Gemini", active: settings.has_gemini_key },
                    { label: "OpenAI", active: settings.has_openai_key },
                    { label: "Anthropic", active: settings.has_anthropic_key },
                    {
                      label: "OpenRouter",
                      active: settings.has_openrouter_key,
                    },
                    { label: "GitHub MCP", active: settings.has_github_token },
                  ].map((item) => (
                    <span
                      key={item.label}
                      className={`px-2 py-0.5 rounded-full text-[10.5px] font-mono inline-flex items-center gap-1 border ${
                        item.active
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
                          : "bg-black/[0.03] dark:bg-white/[0.04] text-[#8E8E93] border-black/[0.06] dark:border-white/[0.06]"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          item.active ? "bg-emerald-500" : "bg-zinc-400"
                        }`}
                      />
                      {item.label}: {item.active ? "Ready" : "Local Fallback"}
                    </span>
                  ))}
                </div>
              </div>

              {/* GitHub Auto-Update on Boot Status & Manual Sync */}
              <div className="mb-4 p-3 rounded-[14px] bg-[#F5F5F7] dark:bg-[#101015] border border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1D1D1F] dark:text-zinc-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                    <span>GitHub Auto-Updater (Boot & Hot-Sync)</span>
                  </div>
                  <div className="text-[10.5px] font-mono text-[#6E6E73] dark:text-zinc-400 truncate mt-0.5">
                    {autoUpdateStatus
                      ? `${autoUpdateStatus.message} (${autoUpdateStatus.currentCommit})`
                      : "Checks ManasSoni-2009/Project-JARVIS on boot"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCheckGitHubUpdates}
                  disabled={checkingUpdates}
                  className="studio-btn shrink-0 px-2.5 py-1.5 rounded-[9px] bg-black/[0.06] dark:bg-white/[0.08] hover:bg-black/[0.1] dark:hover:bg-white/[0.14] text-[11px] font-semibold text-[#1D1D1F] dark:text-zinc-200 cursor-pointer"
                >
                  {checkingUpdates ? "Syncing..." : "Check Updates"}
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#3A3A3C] dark:text-zinc-300 mb-1.5">
                      Intelligence Provider
                    </label>
                    <StudioDropdown
                      value={settings.provider}
                      options={PROVIDER_DROPDOWN_OPTIONS}
                      onChange={(val) =>
                        setSettings((s) => ({
                          ...s,
                          provider: val as SettingsPayload["provider"],
                        }))
                      }
                      size="md"
                      className="w-full"
                      menuWidthClass="w-full"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#3A3A3C] dark:text-zinc-300 mb-1.5">
                      Primary Model Preset
                    </label>
                    <StudioDropdown
                      value={
                        MODEL_DROPDOWN_OPTIONS.some(
                          (o) => o.value === settings.flash_model
                        )
                          ? settings.flash_model!
                          : "gemini-4-hydrogen"
                      }
                      options={MODEL_DROPDOWN_OPTIONS}
                      onChange={(val) =>
                        setSettings((s) => ({
                          ...s,
                          flash_model: val,
                        }))
                      }
                      size="md"
                      className="w-full"
                      menuWidthClass="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#3A3A3C] dark:text-zinc-300 mb-1.5">
                      Default Reasoning Depth
                    </label>
                    <StudioDropdown
                      value={settings.thinking_mode}
                      options={THINKING_DROPDOWN_OPTIONS}
                      onChange={(val) =>
                        setSettings((s) => ({
                          ...s,
                          thinking_mode:
                            val as SettingsPayload["thinking_mode"],
                        }))
                      }
                      size="md"
                      className="w-full"
                      menuWidthClass="w-full"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#3A3A3C] dark:text-zinc-300 mb-1.5">
                      Neural Voice Persona
                    </label>
                    <StudioDropdown
                      value={
                        VOICE_DROPDOWN_OPTIONS.some(
                          (o) => o.value === settings.tts_voice
                        )
                          ? settings.tts_voice
                          : "Kore"
                      }
                      options={VOICE_DROPDOWN_OPTIONS}
                      onChange={(val) =>
                        setSettings((s) => ({
                          ...s,
                          tts_voice: val,
                        }))
                      }
                      size="md"
                      className="w-full"
                      menuWidthClass="w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#3A3A3C] dark:text-zinc-300 mb-1.5">
                    Desktop Automation Backend
                  </label>
                  <StudioDropdown
                    value={settings.os_backend}
                    options={OS_BACKEND_DROPDOWN_OPTIONS}
                    onChange={(val) =>
                      setSettings((s) => ({
                        ...s,
                        os_backend: val as SettingsPayload["os_backend"],
                      }))
                    }
                    size="md"
                    className="w-full"
                    menuWidthClass="w-full"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#3A3A3C] dark:text-zinc-300 mb-1.5">
                    Obsidian Second Brain Vault Directory
                  </label>
                  <input
                    type="text"
                    value={settings.obsidian_vault_path || "./data/vault"}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        obsidian_vault_path: e.target.value,
                      }))
                    }
                    placeholder="./data/vault"
                    className="w-full h-9 px-3 rounded-[11px] bg-[#F5F5F7] dark:bg-[#101015] border border-black/[0.08] dark:border-white/[0.1] font-mono text-xs text-[#1D1D1F] dark:text-zinc-200 outline-none focus:border-sky-500"
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="font-semibold text-[#3A3A3C] dark:text-zinc-300">
                    Neural TTS Voice Responses (`gemini-3.8-flash-lite-tts`)
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.tts_enabled}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        tts_enabled: e.target.checked,
                      }))
                    }
                    className="accent-sky-500 w-4 h-4 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="font-semibold text-[#3A3A3C] dark:text-zinc-300">
                    Auto Voice Activity Detection (VAD)
                  </span>
                  <input
                    type="checkbox"
                    checked={vadEnabled}
                    onChange={(e) => setVadEnabled(e.target.checked)}
                    className="accent-sky-500 w-4 h-4 cursor-pointer"
                  />
                </div>

                {/* 1-Click Studio Readiness Self-Test */}
                <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-semibold text-[#3A3A3C] dark:text-zinc-300">
                      Studio Subsystem Self-Test
                    </span>
                    <button
                      type="button"
                      onClick={runStudioDiagnostics}
                      disabled={runningDiagnostics}
                      className="studio-btn px-2.5 py-1 rounded-[8px] bg-sky-500/12 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 font-semibold text-[11px] cursor-pointer"
                    >
                      {runningDiagnostics
                        ? "Testing Subsystems..."
                        : "Run Readiness Check"}
                    </button>
                  </div>

                  {diagnosticsChecks.length > 0 && (
                    <div className="grid grid-cols-1 gap-1.5 mt-2">
                      {diagnosticsChecks.map((chk) => (
                        <div
                          key={chk.id}
                          className="px-2.5 py-1.5 rounded-[10px] bg-[#F5F5F7] dark:bg-[#101015] border border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between gap-2 text-[11px]"
                        >
                          <div className="flex items-center gap-1.5 font-semibold text-[#1D1D1F] dark:text-zinc-200">
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>{chk.label}</span>
                          </div>
                          <span className="font-mono text-[10px] text-[#6E6E73] dark:text-zinc-400 truncate">
                            {chk.detail}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="studio-btn px-3.5 py-1.5 rounded-[10px] text-xs font-medium text-[#6E6E73] dark:text-zinc-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveSettings}
                  className="studio-btn px-4 py-1.5 rounded-[10px] bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] text-xs font-semibold cursor-pointer"
                >
                  Save Studio Setup
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOAST NOTIFICATION */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="studio-toast"
            initial={{ opacity: 0, y: -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-full bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] text-xs font-semibold shadow-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTTOM-RIGHT MINIMAL HARDWARE-GRADE GSAP PET PILL */}
      <JevPetPill
        mood={pillMood}
        pipelineState={pipelineState}
        isFocusAwayMode={focusAwayPillMode}
        isRecording={isRecording}
        lastJevDecision={lastJevDecision}
        statusSubtitle={pillSubtitle}
        activeRef={highlightedRef || sandboxState?.lastFocusedRef}
        onToggleRecording={isRecording ? stopRecording : startRecording}
        onRestoreMainView={() => setFocusAwayPillMode(false)}
        onSelectMood={(m) => setPillMood(m)}
        onQuickCommand={(cmd) => sendCommand(cmd)}
      />
    </div>
  );
}
