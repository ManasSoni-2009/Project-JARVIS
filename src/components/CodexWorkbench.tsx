import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  Check,
  Code2,
  Cpu,
  FileCode,
  FolderKanban,
  Layers,
  MousePointerClick,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Unplug,
  X,
} from "lucide-react";
import {
  AccessibilityNode,
  CodexDiffPatch,
  NusMilestone,
  OpenJarvisTrace,
  SandboxAppState,
  VaultNoteItem,
} from "../types/jarvis.ts";
import { StudioDropdown, StudioDropdownOption } from "./StudioDropdown.tsx";

export type WorkbenchTab = "diff" | "desktop" | "telemetry" | "nus_vault";

interface CodexWorkbenchProps {
  activeTab: WorkbenchTab;
  onSelectTab: (tab: WorkbenchTab) => void;
  onCloseFrame?: () => void;
  files: Array<{ path: string; content: string }>;
  patches: CodexDiffPatch[];
  selectedPatchId: string | null;
  onSelectPatch: (id: string) => void;
  onApplyPatch: (id: string) => void;
  onRevertPatch: (id: string) => void;
  accessibilityTree: AccessibilityNode[];
  sandboxState: SandboxAppState | null;
  highlightedRef: string | null;
  onExecuteDesktopCommand: (cmd: {
    command: "snapshot" | "click" | "type" | "press" | "focus";
    ref?: string;
    text?: string;
    key?: string;
  }) => void;
  onToggleLocalBridge: (connected: boolean, host: string) => void;
  traces: OpenJarvisTrace[];
  milestones: NusMilestone[];
  onAddMilestone: (item: {
    title: string;
    courseOrProject: string;
    dueDate: string;
    priority: "high" | "medium" | "low";
  }) => void;
  onUpdateMilestoneStatus: (
    id: string,
    status: "todo" | "in_progress" | "done"
  ) => void;
  onDeleteMilestone: (id: string) => void;
  vaultNotes: VaultNoteItem[];
  onCreateVaultNote: (title: string, content: string) => void;
  onDeleteVaultNote?: (stem: string) => void;
  onAppendDailyNote?: (entry: string) => void;
}

const INSPECTOR_HEADER_META: Record<
  WorkbenchTab,
  {
    title: string;
    subtitle: string;
    icon: React.FC<{ className?: string }>;
    accentClass: string;
  }
> = {
  diff: {
    title: "Diff Outbox & Source",
    subtitle: "Hedwig review-before-apply patch queue",
    icon: Code2,
    accentClass: "text-emerald-500",
  },
  desktop: {
    title: "Agent-Desktop @ref",
    subtitle: "Semantic accessibility tree & CLI bridge",
    icon: MousePointerClick,
    accentClass: "text-sky-500",
  },
  nus_vault: {
    title: "NŪS & Second Brain",
    subtitle: "Milestones & Obsidian markdown knowledge",
    icon: FolderKanban,
    accentClass: "text-amber-500",
  },
  telemetry: {
    title: "OpenJarvis Telemetry",
    subtitle: "5-Primitive stack & System-1/System-2 traces",
    icon: Activity,
    accentClass: "text-violet-500",
  },
};

const PRIORITY_OPTIONS: StudioDropdownOption[] = [
  {
    value: "high",
    label: "High Priority",
    badge: "P0",
    badgeColor: "rose",
    dotColor: "#F43F5E",
  },
  {
    value: "medium",
    label: "Medium",
    badge: "P1",
    badgeColor: "amber",
    dotColor: "#F59E0B",
  },
  {
    value: "low",
    label: "Low",
    badge: "P2",
    badgeColor: "sky",
    dotColor: "#0EA5E9",
  },
];

export const CodexWorkbench: React.FC<CodexWorkbenchProps> = ({
  activeTab,
  onCloseFrame,
  files,
  patches,
  selectedPatchId,
  onSelectPatch,
  onApplyPatch,
  onRevertPatch,
  accessibilityTree,
  sandboxState,
  highlightedRef,
  onExecuteDesktopCommand,
  onToggleLocalBridge,
  traces,
  milestones,
  onAddMilestone,
  onUpdateMilestoneStatus,
  onDeleteMilestone,
  vaultNotes,
  onCreateVaultNote,
  onDeleteVaultNote,
  onAppendDailyNote,
}) => {
  const [selectedFilePath, setSelectedFilePath] = useState<string>(
    files[0]?.path || "src/harness/jevReflexRouter.ts"
  );
  const [refInputText, setRefInputText] = useState<string>("npm run verify:all");
  const [selectedRef, setSelectedRef] = useState<string>("@e3");
  const [bridgeHostInput, setBridgeHostInput] = useState<string>(
    sandboxState?.localBridgeHost || "ws://127.0.0.1:44820"
  );

  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneCourse] = useState("OpenJarvis Sprint");
  const [newMilestonePriority, setNewMilestonePriority] = useState<
    "high" | "medium" | "low"
  >("high");

  // Full Obsidian Second Brain Workspace State
  const [vaultSubTab, setVaultSubTab] = useState<
    "editor" | "graph" | "milestones"
  >("editor");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [selectedNoteStem, setSelectedNoteStem] = useState<string>(
    "Welcome to JARVIS"
  );
  const [editorTitle, setEditorTitle] = useState<string>("Welcome to JARVIS");
  const [editorContent, setEditorContent] = useState<string>("");
  const [isCreatingNewNote, setIsCreatingNewNote] = useState<boolean>(false);
  const [dailyEntryInput, setDailyEntryInput] = useState<string>("");
  const [ragQueryInput, setRagQueryInput] = useState<string>("");
  const [ragAnswer, setRagAnswer] = useState<string | null>(null);
  const [ragLoading, setRagLoading] = useState<boolean>(false);

  const allVaultTags = useMemo(() => {
    const s = new Set<string>();
    for (const n of vaultNotes) {
      for (const t of n.tags || []) s.add(t);
    }
    return ["all", ...Array.from(s)];
  }, [vaultNotes]);

  const filteredVaultNotes = useMemo(() => {
    if (selectedTag === "all") return vaultNotes;
    return vaultNotes.filter((n) => (n.tags || []).includes(selectedTag));
  }, [selectedTag, vaultNotes]);

  const activeVaultNote = useMemo(() => {
    return (
      vaultNotes.find(
        (n) => n.stem.toLowerCase() === selectedNoteStem.toLowerCase()
      ) ||
      vaultNotes[0] ||
      null
    );
  }, [selectedNoteStem, vaultNotes]);

  const handleSelectVaultNote = (note: VaultNoteItem) => {
    setIsCreatingNewNote(false);
    setSelectedNoteStem(note.stem);
    setEditorTitle(note.stem);
    setEditorContent(note.content || note.preview || "");
  };

  const handleJumpToWikilink = (targetStem: string) => {
    const found = vaultNotes.find(
      (n) => n.stem.toLowerCase() === targetStem.toLowerCase()
    );
    if (found) {
      handleSelectVaultNote(found);
      setVaultSubTab("editor");
    } else {
      setIsCreatingNewNote(true);
      setEditorTitle(targetStem);
      setEditorContent(`# ${targetStem}\n\nLinked from [[${selectedNoteStem}]].\n`);
      setVaultSubTab("editor");
    }
  };

  const handleRunVaultRag = async () => {
    if (!ragQueryInput.trim()) return;
    setRagLoading(true);
    try {
      const res = await fetch("/api/vault/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: ragQueryInput.trim() }),
      });
      const data = await res.json();
      if (data.answer) setRagAnswer(data.answer);
    } catch {
      setRagAnswer("Failed to query Obsidian Second Brain.");
    } finally {
      setRagLoading(false);
    }
  };

  const activePatch =
    patches.find((p) => p.id === selectedPatchId) || patches[0] || null;

  const flattenTree = (
    nodes: AccessibilityNode[],
    depth = 0
  ): Array<{ node: AccessibilityNode; depth: number }> => {
    const out: Array<{ node: AccessibilityNode; depth: number }> = [];
    for (const n of nodes) {
      out.push({ node: n, depth });
      if (n.children && n.children.length > 0) {
        out.push(...flattenTree(n.children, depth + 1));
      }
    }
    return out;
  };

  const flatNodes = flattenTree(accessibilityTree);
  const headerMeta = INSPECTOR_HEADER_META[activeTab];
  const HeaderIcon = headerMeta.icon;

  const patchDropdownOptions: StudioDropdownOption[] = useMemo(
    () =>
      patches.map((p) => ({
        value: p.id,
        label: p.filePath.split("/").pop() || p.filePath,
        sublabel: p.title,
        badge: p.applied ? "Applied" : `+${p.additions}/-${p.deletions}`,
        badgeColor: p.applied ? "emerald" : "amber",
        dotColor: p.applied ? "#10B981" : "#F59E0B",
      })),
    [patches]
  );

  const refDropdownOptions: StudioDropdownOption[] = useMemo(
    () =>
      flatNodes.map(({ node }) => ({
        value: node.ref,
        label: `${node.ref} · ${node.role}`,
        sublabel: node.name,
        badge: node.windowId.replace("win-", ""),
        badgeColor: "sky",
      })),
    [flatNodes]
  );

  return (
    <motion.aside
      initial={{ opacity: 0, x: 24, scale: 0.985 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.985 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="w-full lg:w-[435px] xl:w-[480px] shrink-0 h-full rounded-[22px] bg-white/90 dark:bg-[#131317]/92 backdrop-blur-2xl border border-black/[0.07] dark:border-white/[0.08] shadow-[0_12px_36px_-10px_rgba(0,0,0,0.06)] dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden select-none"
    >
      {/* Animated Inspector Header */}
      <div className="h-13 px-4 border-b border-black/[0.06] dark:border-white/[0.07] flex items-center justify-between gap-3 shrink-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-2.5 min-w-0"
          >
            <div className="w-7 h-7 rounded-[9px] bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center shrink-0">
              <HeaderIcon className={`w-3.5 h-3.5 ${headerMeta.accentClass}`} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[#1D1D1F] dark:text-white truncate">
                {headerMeta.title}
              </div>
              <div className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93] truncate">
                {headerMeta.subtitle}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {onCloseFrame && (
          <button
            type="button"
            onClick={onCloseFrame}
            title="Close Inspector"
            className="studio-btn w-7 h-7 rounded-full flex items-center justify-center text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Animated Section Body */}
      <AnimatePresence mode="wait">
        {/* VIEW 1: CODEX DIFF OUTBOX & WORKSPACE SOURCE */}
        {activeTab === "diff" && (
          <motion.div
            key="tab-diff"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 flex flex-col min-h-0 overflow-hidden"
          >
            <div className="px-4 py-2.5 border-b border-black/[0.06] dark:border-white/[0.07] bg-[#F8F8FA]/80 dark:bg-[#17171C]/60 flex items-center justify-between gap-2.5 z-20">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <StudioDropdown
                  value={activePatch?.id || ""}
                  options={patchDropdownOptions}
                  onChange={onSelectPatch}
                  mono
                  icon={<FileCode className="w-3.5 h-3.5" />}
                  className="w-[215px]"
                  menuWidthClass="w-[290px]"
                />
                {activePatch && (
                  <div className="text-[11px] font-mono text-[#6E6E73] dark:text-zinc-400 flex items-center gap-1 shrink-0 tabular-nums">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      +{activePatch.additions}
                    </span>
                    <span>/</span>
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">
                      -{activePatch.deletions}
                    </span>
                  </div>
                )}
              </div>

              {activePatch && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {!activePatch.applied ? (
                    <button
                      type="button"
                      onClick={() => onApplyPatch(activePatch.id)}
                      className="studio-btn px-3 py-1.5 rounded-[10px] bg-[#1D1D1F] dark:bg-white hover:opacity-90 text-white dark:text-[#1D1D1F] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onRevertPatch(activePatch.id)}
                      className="studio-btn px-3 py-1.5 rounded-[10px] bg-black/[0.06] dark:bg-white/[0.08] hover:bg-black/[0.1] dark:hover:bg-white/[0.14] text-[#1D1D1F] dark:text-zinc-200 text-xs font-medium inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Revert</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto studio-scroll p-4 space-y-4 select-text">
              {activePatch ? (
                <motion.div
                  key={activePatch.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-[14px] border border-black/[0.07] dark:border-white/[0.08] bg-[#F8F8FA] dark:bg-[#0B0B0E] overflow-hidden"
                >
                  <div className="px-3.5 py-2 border-b border-black/[0.06] dark:border-white/[0.07] bg-white/80 dark:bg-[#121217] flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#1D1D1F] dark:text-zinc-100 truncate">
                      {activePatch.title}
                    </span>
                    <span className="font-mono text-[10.5px] text-[#6E6E73] dark:text-zinc-400 shrink-0">
                      {activePatch.applied ? "Committed" : "Outbox Ready"}
                    </span>
                  </div>
                  <div className="py-2 font-mono text-[11.5px] leading-relaxed overflow-x-auto studio-scroll">
                    {activePatch.unifiedDiff.split("\n").map((line, idx) => {
                      const isAdd =
                        line.startsWith("+") && !line.startsWith("+++");
                      const isDel =
                        line.startsWith("-") && !line.startsWith("---");
                      const isHeader =
                        line.startsWith("@@") ||
                        line.startsWith("---") ||
                        line.startsWith("+++");
                      return (
                        <div
                          key={idx}
                          className={`px-3.5 py-0.5 flex items-start gap-2.5 transition-colors duration-150 ${
                            isAdd
                              ? "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300"
                              : isDel
                              ? "bg-rose-500/12 text-rose-800 dark:text-rose-300"
                              : isHeader
                              ? "bg-sky-500/10 text-sky-800 dark:text-sky-300"
                              : "text-[#3A3A3C] dark:text-zinc-300"
                          }`}
                        >
                          <span className="w-5 text-right text-[#8E8E93] dark:text-zinc-600 select-none shrink-0 tabular-nums">
                            {idx + 1}
                          </span>
                          <span className="whitespace-pre">{line}</span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              ) : (
                <div className="text-center py-10 text-xs text-[#6E6E73] dark:text-zinc-500">
                  Ask J.A.R.V.I.S to refactor a file to inspect a unified diff.
                </div>
              )}

              {/* Workspace Source Files with Liquid Sliding Tab Pill */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-[#6E6E73] dark:text-zinc-400">
                    Workspace Source (`./data/codex-workspace`)
                  </span>
                  <div className="flex items-center gap-1 p-0.5 rounded-[10px] bg-black/[0.04] dark:bg-white/[0.06]">
                    {files.map((f) => {
                      const active = selectedFilePath === f.path;
                      return (
                        <button
                          key={f.path}
                          type="button"
                          onClick={() => setSelectedFilePath(f.path)}
                          className={`relative px-2.5 py-1 rounded-[8px] text-[10.5px] font-mono transition-colors cursor-pointer ${
                            active
                              ? "text-white dark:text-[#1D1D1F] font-semibold"
                              : "text-[#6E6E73] dark:text-zinc-400 hover:text-[#1D1D1F] dark:hover:text-white"
                          }`}
                        >
                          {active && (
                            <motion.div
                              layoutId="activeSourceFilePill"
                              transition={{
                                type: "spring",
                                stiffness: 420,
                                damping: 32,
                              }}
                              className="absolute inset-0 rounded-[8px] bg-[#1D1D1F] dark:bg-white"
                            />
                          )}
                          <span className="relative z-10">
                            {f.path.split("/").pop()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.pre
                    key={selectedFilePath}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="p-3.5 rounded-[14px] border border-black/[0.07] dark:border-white/[0.08] bg-[#F8F8FA] dark:bg-[#0B0B0E] font-mono text-[11.5px] text-[#1D1D1F] dark:text-zinc-300 overflow-x-auto studio-scroll leading-relaxed"
                  >
                    {files.find((f) => f.path === selectedFilePath)?.content ||
                      files[0]?.content}
                  </motion.pre>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}

        {/* VIEW 2: VERCEL-LABS/AGENT-DESKTOP ACCESSIBILITY TREE & SANDBOX */}
        {activeTab === "desktop" && (
          <motion.div
            key="tab-desktop"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 flex flex-col min-h-0 overflow-y-auto studio-scroll p-4 gap-3.5"
          >
            <div className="p-3.5 rounded-[14px] border border-black/[0.07] dark:border-white/[0.08] bg-[#F8F8FA] dark:bg-[#0E0E12] flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Unplug className="w-3.5 h-3.5 text-sky-500" />
                  <span className="text-xs font-semibold text-[#1D1D1F] dark:text-zinc-100">
                    Local CLI Bridge
                  </span>
                  <span className="text-[11px] text-[#6E6E73] dark:text-zinc-400 font-mono">
                    ·{" "}
                    {sandboxState?.localBridgeConnected
                      ? "Attached"
                      : "Web Sandbox"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onToggleLocalBridge(
                      !sandboxState?.localBridgeConnected,
                      bridgeHostInput
                    )
                  }
                  className={`studio-btn px-2.5 py-1 rounded-[10px] text-[11px] font-semibold cursor-pointer ${
                    sandboxState?.localBridgeConnected
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-black/[0.06] dark:bg-white/[0.08] text-[#1D1D1F] dark:text-zinc-200"
                  }`}
                >
                  {sandboxState?.localBridgeConnected
                    ? "Connected"
                    : "Attach CLI"}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={bridgeHostInput}
                  onChange={(e) => setBridgeHostInput(e.target.value)}
                  placeholder="ws://127.0.0.1:44820"
                  className="flex-1 bg-white dark:bg-[#09090C] border border-black/[0.08] dark:border-white/[0.09] focus:border-sky-500/60 rounded-[10px] px-2.5 py-1 text-xs font-mono text-[#1D1D1F] dark:text-zinc-300 outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() =>
                    onExecuteDesktopCommand({ command: "snapshot" })
                  }
                  className="studio-btn px-2.5 py-1 rounded-[10px] bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Snapshot</span>
                </button>
              </div>
            </div>

            <div className="rounded-[14px] border border-black/[0.07] dark:border-white/[0.08] bg-[#F8F8FA] dark:bg-[#0B0B0E] p-3.5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1D1D1F] dark:text-zinc-200">
                  Interactive Desktop Sandbox
                </span>
                <span className="font-mono text-[11px] text-sky-600 dark:text-sky-400">
                  Focus · {sandboxState?.lastFocusedRef || "@e3"}
                </span>
              </div>

              <div
                className={`p-3 rounded-[10px] border transition-all duration-200 ${
                  sandboxState?.activeWindowId === "win-codex-runner"
                    ? "border-sky-500/45 bg-white dark:bg-[#13151C] shadow-xs"
                    : "border-black/[0.06] dark:border-white/[0.07] bg-white/60 dark:bg-[#101014]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1D1D1F] dark:text-zinc-100">
                    <span className="font-mono text-[11px] text-sky-600 dark:text-sky-400">
                      @e1
                    </span>
                    <span>Codex Build & Test Runner</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onExecuteDesktopCommand({ command: "click", ref: "@e6" })
                    }
                    className="studio-btn text-[10.5px] font-mono px-2 py-0.5 rounded-[8px] bg-black/[0.05] dark:bg-white/[0.07] text-[#1D1D1F] dark:text-zinc-300 cursor-pointer"
                  >
                    @e6 · {sandboxState?.buildTarget || "production"}
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-sky-600 dark:text-sky-400">
                      @e3
                    </span>
                    <input
                      type="text"
                      value={sandboxState?.terminalInput || ""}
                      onChange={(e) =>
                        onExecuteDesktopCommand({
                          command: "type",
                          ref: "@e3",
                          text: e.target.value,
                        })
                      }
                      className="w-full pl-9 pr-2.5 py-1 rounded-[8px] bg-[#F2F2F7] dark:bg-[#09090B] border border-black/[0.08] dark:border-white/[0.09] focus:border-sky-500/60 font-mono text-xs text-[#1D1D1F] dark:text-zinc-200 outline-none transition-colors"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onExecuteDesktopCommand({ command: "click", ref: "@e4" })
                    }
                    className="studio-btn px-3 py-1 rounded-[8px] bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] font-semibold text-xs inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Play className="w-3 h-3" />
                    <span>@e4 Run</span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#6E6E73] dark:text-zinc-400 mb-2">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(sandboxState?.autoDeployEnabled)}
                      onChange={() =>
                        onExecuteDesktopCommand({
                          command: "click",
                          ref: "@e5",
                        })
                      }
                      className="accent-sky-500"
                    />
                    <span className="font-mono text-[10.5px] text-sky-600 dark:text-sky-400">
                      @e5
                    </span>
                    <span>Auto-deploy on green build</span>
                  </label>
                </div>

                <div className="p-2 rounded-[8px] bg-[#F2F2F7] dark:bg-[#08080A] border border-black/[0.05] dark:border-white/[0.06] font-mono text-[11px] text-emerald-700 dark:text-emerald-300">
                  <span className="text-sky-600 dark:text-sky-400 mr-1.5">
                    @e7
                  </span>
                  {sandboxState?.terminalLastOutput}
                </div>
              </div>

              <div
                className={`p-3 rounded-[10px] border transition-all duration-200 ${
                  sandboxState?.activeWindowId === "win-nus-planner"
                    ? "border-sky-500/45 bg-white dark:bg-[#13151C] shadow-xs"
                    : "border-black/[0.06] dark:border-white/[0.07] bg-white/60 dark:bg-[#101014]"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1D1D1F] dark:text-zinc-100">
                    <span className="font-mono text-[11px] text-sky-600 dark:text-sky-400">
                      @e8
                    </span>
                    <span>NŪS Companion Scratchpad</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        onExecuteDesktopCommand({
                          command: "click",
                          ref: "@e12",
                        })
                      }
                      className="studio-btn px-2 py-0.5 rounded-[7px] bg-sky-500/15 text-sky-700 dark:text-sky-300 font-mono text-[10.5px] cursor-pointer"
                    >
                      @e12 Sync
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onExecuteDesktopCommand({
                          command: "click",
                          ref: "@e13",
                        })
                      }
                      className="studio-btn px-2 py-0.5 rounded-[7px] bg-black/[0.06] dark:bg-white/[0.08] text-[#1D1D1F] dark:text-zinc-300 font-mono text-[10.5px] cursor-pointer"
                    >
                      @e13 Clear
                    </button>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-[#3A3A3C] dark:text-zinc-300 bg-[#F2F2F7] dark:bg-[#08080A] border border-black/[0.05] dark:border-white/[0.06] rounded-[8px] p-2">
                  <div className="text-[#6E6E73] dark:text-zinc-400 mb-0.5">
                    <span className="text-sky-600 dark:text-sky-400">@e10</span>{" "}
                    {sandboxState?.quickNoteTitle}
                  </div>
                  <div>
                    <span className="text-sky-600 dark:text-sky-400">@e11</span>{" "}
                    {sandboxState?.quickNoteBody || "(Empty buffer)"}
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Animated @ref Selector Bar */}
            <div className="p-3 rounded-[14px] border border-black/[0.07] dark:border-white/[0.08] bg-[#F8F8FA] dark:bg-[#0E0E12] flex items-center gap-1.5 z-20">
              <StudioDropdown
                value={selectedRef}
                options={refDropdownOptions}
                onChange={setSelectedRef}
                mono
                className="w-[140px] shrink-0"
                menuWidthClass="w-[260px]"
              />
              <input
                type="text"
                value={refInputText}
                onChange={(e) => setRefInputText(e.target.value)}
                placeholder="Text to type..."
                className="flex-1 min-w-0 h-8 bg-white dark:bg-[#09090C] border border-black/[0.08] dark:border-white/[0.09] focus:border-sky-500/60 rounded-[10px] px-2.5 text-xs font-mono text-[#1D1D1F] dark:text-zinc-200 outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() =>
                  onExecuteDesktopCommand({
                    command: "click",
                    ref: selectedRef,
                  })
                }
                className="studio-btn h-8 px-2.5 rounded-[10px] bg-black/[0.06] dark:bg-white/[0.08] text-xs font-semibold text-[#1D1D1F] dark:text-zinc-200 cursor-pointer shrink-0"
              >
                Click
              </button>
              <button
                type="button"
                onClick={() =>
                  onExecuteDesktopCommand({
                    command: "type",
                    ref: selectedRef,
                    text: refInputText,
                  })
                }
                className="studio-btn h-8 px-2.5 rounded-[10px] bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] text-xs font-semibold cursor-pointer shrink-0"
              >
                Type
              </button>
            </div>

            <div className="rounded-[14px] border border-black/[0.07] dark:border-white/[0.08] bg-[#F8F8FA] dark:bg-[#0B0B0E] overflow-hidden">
              <div className="px-3.5 py-2 border-b border-black/[0.06] dark:border-white/[0.07] bg-white/80 dark:bg-[#121217] flex items-center justify-between text-xs">
                <span className="font-semibold text-[#1D1D1F] dark:text-zinc-200">
                  Accessibility Tree (`snapshot`)
                </span>
                <span className="font-mono text-[10.5px] text-[#6E6E73] dark:text-zinc-400 tabular-nums">
                  {flatNodes.length} nodes
                </span>
              </div>
              <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05] font-mono text-[11.5px]">
                {flatNodes.map(({ node, depth }) => {
                  const isHighlighted =
                    highlightedRef === node.ref ||
                    sandboxState?.lastFocusedRef === node.ref;
                  return (
                    <div
                      key={node.ref}
                      style={{ paddingLeft: `${12 + depth * 14}px` }}
                      className={`py-1.5 pr-3 flex items-center justify-between gap-2 transition-colors duration-200 ${
                        isHighlighted
                          ? "bg-sky-500/12 text-sky-900 dark:text-sky-200"
                          : "hover:bg-black/[0.03] dark:hover:bg-white/[0.03] text-[#3A3A3C] dark:text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-bold text-sky-600 dark:text-sky-400 shrink-0">
                          {node.ref}
                        </span>
                        <span className="text-[#8E8E93] dark:text-zinc-500 shrink-0">
                          · {node.role} ·
                        </span>
                        <span className="truncate text-[#1D1D1F] dark:text-zinc-200">
                          {node.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            onExecuteDesktopCommand({
                              command: "click",
                              ref: node.ref,
                            })
                          }
                          className="studio-btn px-2 py-0.5 rounded-[7px] bg-black/[0.06] dark:bg-white/[0.08] hover:bg-[#1D1D1F] hover:text-white dark:hover:bg-white dark:hover:text-[#1D1D1F] text-[10.5px] text-[#1D1D1F] dark:text-zinc-300 cursor-pointer"
                        >
                          Act
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* VIEW 3: OPENJARVIS 5-PRIMITIVE TELEMETRY */}
        {activeTab === "telemetry" && (
          <motion.div
            key="tab-telemetry"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 flex flex-col min-h-0 overflow-y-auto studio-scroll p-4 gap-3.5"
          >
            <div className="rounded-[14px] border border-black/[0.07] dark:border-white/[0.08] bg-[#F8F8FA] dark:bg-[#0E0E12] p-3.5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-violet-500" />
                  <span className="text-xs font-semibold text-[#1D1D1F] dark:text-zinc-100">
                    OpenJarvis 5-Primitive Stack
                  </span>
                </div>
                <span className="font-mono text-[10.5px] text-emerald-600 dark:text-emerald-400">
                  Online
                </span>
              </div>

              <div className="grid grid-cols-1 gap-1.5 text-xs">
                {[
                  {
                    title: "1. Intelligence Registry",
                    sub: "gemini-4-hydrogen · 3.5-transcribe · 3.8-tts",
                    metric: "Active",
                    color: "text-sky-600 dark:text-sky-400",
                  },
                  {
                    title: "2. InferenceEngine Runtime",
                    sub: "Jev Reflex Router + System-2 Deep Planner",
                    metric: `${traces[0]?.engineMetrics.system1Ms ?? 4}ms Sys-1`,
                    color: "text-emerald-600 dark:text-emerald-400",
                  },
                  {
                    title: "3. Agentic Logic Graph",
                    sub: "CodexDiff · AgentDesktop · NŪS · Browser · MCP · Obsidian",
                    metric: "7 Nodes",
                    color: "text-violet-600 dark:text-violet-400",
                  },
                  {
                    title: "4. Tools & Memory",
                    sub: "Session Thread Store · @ref Tree · Obsidian RAG",
                    metric: `${flatNodes.length} @refs`,
                    color: "text-amber-600 dark:text-amber-400",
                  },
                  {
                    title: "5. Learning & Trace Loop",
                    sub: "Latency & token efficiency trace telemetry",
                    metric: `${traces.length} Traces`,
                    color: "text-emerald-600 dark:text-emerald-400",
                  },
                ].map((item, i) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: i * 0.035,
                      duration: 0.22,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="p-2.5 rounded-[10px] bg-white dark:bg-[#09090C] border border-black/[0.05] dark:border-white/[0.06] hover:border-black/[0.12] dark:hover:border-white/[0.12] transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-[#1D1D1F] dark:text-zinc-100">
                        {item.title}
                      </div>
                      <div className="text-[10.5px] text-[#6E6E73] dark:text-zinc-400">
                        {item.sub}
                      </div>
                    </div>
                    <span
                      className={`font-mono text-[10.5px] tabular-nums ${item.color}`}
                    >
                      {item.metric}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="rounded-[14px] border border-black/[0.07] dark:border-white/[0.08] bg-[#F8F8FA] dark:bg-[#0B0B0E] overflow-hidden">
              <div className="px-3.5 py-2 border-b border-black/[0.06] dark:border-white/[0.07] bg-white/80 dark:bg-[#121217] flex items-center justify-between text-xs">
                <span className="font-semibold text-[#1D1D1F] dark:text-zinc-100">
                  Execution Traces (`OpenJarvisTrace`)
                </span>
                <span className="font-mono text-[10.5px] text-[#6E6E73] dark:text-zinc-400 tabular-nums">
                  {traces.length} recorded
                </span>
              </div>

              {traces.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#6E6E73] dark:text-zinc-500">
                  Run any prompt to inspect live System-1 and System-2 telemetry.
                </div>
              ) : (
                <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                  {traces.map((tr) => (
                    <div key={tr.traceId} className="p-3.5 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#1D1D1F] dark:text-zinc-100 truncate">
                          {tr.userPrompt}
                        </span>
                        <span className="font-mono text-[10.5px] text-sky-600 dark:text-sky-400 shrink-0 tabular-nums">
                          {tr.engineMetrics.system1Ms}ms ·{" "}
                          {tr.engineMetrics.totalMs}ms
                        </span>
                      </div>
                      <div className="text-[10.5px] text-[#6E6E73] dark:text-zinc-400 font-mono">
                        intent={tr.intent} · tokens≈{tr.engineMetrics.estTokens}{" "}
                        · eff={tr.engineMetrics.energyEfficiencyScore}%
                      </div>
                      <div className="flex flex-col gap-1 mt-1">
                        {tr.steps.map((s) => (
                          <div
                            key={s.id}
                            className="text-[10.5px] font-mono bg-white dark:bg-[#141418] border border-black/[0.05] dark:border-white/[0.05] px-2.5 py-1 rounded-[8px] flex items-center justify-between gap-2"
                          >
                            <span className="text-[#3A3A3C] dark:text-zinc-300 truncate">
                              {s.phase} · {s.title}
                            </span>
                            <span className="text-[#8E8E93] dark:text-zinc-500 shrink-0 tabular-nums">
                              {s.durationMs}ms
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* VIEW 4: FULL OBSIDIAN SECOND BRAIN SPACE & NŪS COMPANION */}
        {activeTab === "nus_vault" && (
          <motion.div
            key="tab-nus-vault"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 flex flex-col min-h-0 overflow-y-auto studio-scroll p-4 gap-3.5"
          >
            {/* Sub-View Switcher: Obsidian Editor | Knowledge Graph & RAG | NŪS Milestones */}
            <div className="flex items-center justify-between gap-2 p-1 rounded-[12px] bg-[#F2F2F7] dark:bg-[#0B0B0E] border border-black/[0.05] dark:border-white/[0.06] shrink-0">
              {[
                { id: "editor" as const, label: `Obsidian Notes (${vaultNotes.length})` },
                { id: "graph" as const, label: "Graph & Deep RAG" },
                {
                  id: "milestones" as const,
                  label: `NŪS Tasks (${milestones.filter((m) => m.status !== "done").length})`,
                },
              ].map((tab) => {
                const active = vaultSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setVaultSubTab(tab.id)}
                    className={`flex-1 h-7 rounded-[9px] text-[11px] font-semibold transition-all cursor-pointer ${
                      active
                        ? "bg-white dark:bg-[#222228] text-[#1D1D1F] dark:text-white shadow-xs"
                        : "text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-zinc-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* SUB-TAB 1: OBSIDIAN MARKDOWN SPACE (Notes List + Tag Filter + Full Markdown Editor + Wikilinks) */}
            {vaultSubTab === "editor" && (
              <div className="flex flex-col gap-3">
                {/* Daily Quick-Log Bar */}
                <div className="p-2.5 rounded-[12px] bg-[#F8F8FA] dark:bg-[#0E0E12] border border-black/[0.06] dark:border-white/[0.07] flex items-center gap-1.5">
                  <input
                    type="text"
                    value={dailyEntryInput}
                    onChange={(e) => setDailyEntryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && dailyEntryInput.trim()) {
                        onAppendDailyNote?.(dailyEntryInput.trim());
                        setDailyEntryInput("");
                      }
                    }}
                    placeholder="Quick log to today's Daily Note (Daily/YYYY-MM-DD.md)..."
                    className="flex-1 min-w-0 h-7 bg-white dark:bg-[#09090C] border border-black/[0.08] dark:border-white/[0.09] rounded-[8px] px-2.5 text-xs text-[#1D1D1F] dark:text-zinc-200 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!dailyEntryInput.trim()) return;
                      onAppendDailyNote?.(dailyEntryInput.trim());
                      setDailyEntryInput("");
                    }}
                    className="studio-btn h-7 px-2.5 rounded-[8px] bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[11px] font-semibold cursor-pointer shrink-0"
                  >
                    + Daily Log
                  </button>
                </div>

                {/* Tag Filter Pills + New Note Button */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1 flex-wrap">
                    {allVaultTags.slice(0, 7).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setSelectedTag(tag)}
                        className={`px-2 py-0.5 rounded-full font-mono text-[10px] cursor-pointer transition-colors ${
                          selectedTag === tag
                            ? "bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] font-semibold"
                            : "bg-black/[0.05] dark:bg-white/[0.07] text-[#6E6E73] dark:text-zinc-400 hover:text-[#1D1D1F] dark:hover:text-white"
                        }`}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNewNote(true);
                      setEditorTitle("");
                      setEditorContent(
                        "---\ntags: [jarvis, note]\n---\n\n# New Note\n\nLinked to [[Welcome to JARVIS]].\n"
                      );
                    }}
                    className="studio-btn px-2.5 py-1 rounded-[8px] bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Note</span>
                  </button>
                </div>

                {/* Horizontal Note Switcher Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto studio-scroll pb-1">
                  {filteredVaultNotes.map((note) => {
                    const isSelected =
                      !isCreatingNewNote &&
                      activeVaultNote?.stem === note.stem;
                    return (
                      <button
                        key={note.stem}
                        type="button"
                        onClick={() => handleSelectVaultNote(note)}
                        className={`px-2.5 py-1.5 rounded-[10px] text-xs font-medium whitespace-nowrap border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? "bg-white dark:bg-[#1C1C24] border-amber-500/50 text-[#1D1D1F] dark:text-white shadow-xs"
                            : "bg-[#F8F8FA] dark:bg-[#0E0E12] border-black/[0.06] dark:border-white/[0.07] text-[#6E6E73] dark:text-zinc-400 hover:text-[#1D1D1F] dark:hover:text-zinc-200"
                        }`}
                      >
                        <FileCode className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>{note.stem}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Active Markdown Note Editor & Wikilink Navigator */}
                <div className="rounded-[14px] border border-black/[0.08] dark:border-white/[0.09] bg-white dark:bg-[#09090C] p-3.5 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={
                        isCreatingNewNote
                          ? editorTitle
                          : editorTitle || activeVaultNote?.stem || ""
                      }
                      onChange={(e) => setEditorTitle(e.target.value)}
                      placeholder="Note title..."
                      className="flex-1 min-w-0 font-bold text-xs text-[#1D1D1F] dark:text-white bg-transparent border-b border-transparent focus:border-amber-500/50 pb-0.5 outline-none"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isCreatingNewNote &&
                        activeVaultNote &&
                        vaultNotes.length > 1 &&
                        onDeleteVaultNote && (
                          <button
                            type="button"
                            onClick={() =>
                              onDeleteVaultNote(activeVaultNote.stem)
                            }
                            title="Delete note"
                            className="studio-btn p-1.5 rounded-[8px] text-[#8E8E93] hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      <button
                        type="button"
                        onClick={() => {
                          const targetTitle = (
                            isCreatingNewNote
                              ? editorTitle
                              : editorTitle || activeVaultNote?.stem || ""
                          ).trim();
                          const targetBody =
                            editorContent ||
                            activeVaultNote?.content ||
                            activeVaultNote?.preview ||
                            "";
                          if (!targetTitle) return;
                          onCreateVaultNote(targetTitle, targetBody);
                          setIsCreatingNewNote(false);
                          setSelectedNoteStem(targetTitle);
                        }}
                        className="studio-btn px-3 py-1 rounded-[8px] bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] text-[11px] font-semibold cursor-pointer"
                      >
                        Save Note
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={10}
                    value={
                      isCreatingNewNote
                        ? editorContent
                        : editorContent ||
                          activeVaultNote?.content ||
                          activeVaultNote?.preview ||
                          ""
                    }
                    onFocus={() => {
                      if (!isCreatingNewNote && !editorContent && activeVaultNote) {
                        setEditorTitle(activeVaultNote.stem);
                        setEditorContent(
                          activeVaultNote.content || activeVaultNote.preview || ""
                        );
                      }
                    }}
                    onChange={(e) => setEditorContent(e.target.value)}
                    placeholder="Write Markdown with [[WikiLinks]] and #tags..."
                    className="w-full rounded-[10px] bg-[#F8F8FA] dark:bg-[#0E0E12] border border-black/[0.06] dark:border-white/[0.07] p-2.5 font-mono text-[11.5px] leading-relaxed text-[#1D1D1F] dark:text-zinc-200 outline-none focus:border-amber-500/50 resize-y"
                  />

                  {/* Outgoing [[Wikilinks]] & Incoming Backlinks */}
                  {activeVaultNote && !isCreatingNewNote && (
                    <div className="pt-1 flex flex-col gap-1.5 text-[11px]">
                      {(activeVaultNote.links || []).length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] text-[#8E8E93]">
                            WikiLinks:
                          </span>
                          {(activeVaultNote.links || []).map((lnk) => (
                            <button
                              key={lnk}
                              type="button"
                              onClick={() => handleJumpToWikilink(lnk)}
                              className="px-2 py-0.5 rounded-[6px] bg-amber-500/12 text-amber-700 dark:text-amber-300 font-mono text-[10.5px] hover:bg-amber-500/25 cursor-pointer"
                            >
                              [[{lnk}]]
                            </button>
                          ))}
                        </div>
                      )}
                      {(activeVaultNote.backlinks || []).length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] text-[#8E8E93]">
                            Referenced by:
                          </span>
                          {(activeVaultNote.backlinks || []).map((bl) => (
                            <button
                              key={bl}
                              type="button"
                              onClick={() => handleJumpToWikilink(bl)}
                              className="px-2 py-0.5 rounded-[6px] bg-sky-500/12 text-sky-700 dark:text-sky-300 font-mono text-[10.5px] hover:bg-sky-500/25 cursor-pointer"
                            >
                              ← {bl}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SUB-TAB 2: INTERACTIVE KNOWLEDGE GRAPH & DEEP RAG QUERY */}
            {vaultSubTab === "graph" && (
              <div className="flex flex-col gap-3">
                {/* Interactive SVG Knowledge Graph */}
                <div className="rounded-[14px] border border-black/[0.07] dark:border-white/[0.08] bg-[#F8F8FA] dark:bg-[#0A0A0E] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#1D1D1F] dark:text-zinc-100">
                      Obsidian Second Brain Graph (`[[WikiLinks]]`)
                    </span>
                    <span className="font-mono text-[10px] text-[#8E8E93]">
                      Click any node to open note
                    </span>
                  </div>

                  <svg
                    viewBox="0 0 380 210"
                    className="w-full h-48 rounded-[10px] bg-white dark:bg-[#07070A] border border-black/[0.05] dark:border-white/[0.06]"
                  >
                    {(() => {
                      const nodes = vaultNotes.slice(0, 7);
                      const coords = nodes.map((n, idx) => {
                        if (idx === 0) return { note: n, x: 190, y: 105 };
                        const angle =
                          ((idx - 1) / Math.max(1, nodes.length - 1)) *
                          Math.PI *
                          2;
                        return {
                          note: n,
                          x: Math.round(190 + Math.cos(angle) * 125),
                          y: Math.round(105 + Math.sin(angle) * 68),
                        };
                      });

                      const edges: Array<{
                        x1: number;
                        y1: number;
                        x2: number;
                        y2: number;
                        key: string;
                      }> = [];
                      for (const src of coords) {
                        for (const targetName of src.note.links || []) {
                          const dst = coords.find(
                            (c) =>
                              c.note.stem.toLowerCase() ===
                              targetName.toLowerCase()
                          );
                          if (dst) {
                            edges.push({
                              x1: src.x,
                              y1: src.y,
                              x2: dst.x,
                              y2: dst.y,
                              key: `${src.note.stem}->${dst.note.stem}`,
                            });
                          }
                        }
                      }

                      return (
                        <>
                          {edges.map((e) => (
                            <line
                              key={e.key}
                              x1={e.x1}
                              y1={e.y1}
                              x2={e.x2}
                              y2={e.y2}
                              stroke="#F59E0B"
                              strokeOpacity={0.45}
                              strokeWidth={1.5}
                            />
                          ))}
                          {coords.map((c) => {
                            const isSelected =
                              c.note.stem === activeVaultNote?.stem;
                            return (
                              <g
                                key={c.note.stem}
                                onClick={() => {
                                  handleSelectVaultNote(c.note);
                                  setVaultSubTab("editor");
                                }}
                                className="cursor-pointer"
                              >
                                <circle
                                  cx={c.x}
                                  cy={c.y}
                                  r={isSelected ? 11 : 8}
                                  fill={isSelected ? "#F59E0B" : "#0EA5E9"}
                                  fillOpacity={0.9}
                                />
                                <text
                                  x={c.x}
                                  y={c.y + 20}
                                  textAnchor="middle"
                                  fill="currentColor"
                                  className="text-[9px] font-mono fill-[#1D1D1F] dark:fill-zinc-300"
                                >
                                  {c.note.stem.slice(0, 20)}
                                </text>
                              </g>
                            );
                          })}
                        </>
                      );
                    })()}
                  </svg>
                </div>

                {/* Deep RAG Vault Query */}
                <div className="rounded-[14px] border border-black/[0.07] dark:border-white/[0.08] bg-[#F8F8FA] dark:bg-[#0E0E12] p-3.5 flex flex-col gap-2.5">
                  <div className="text-xs font-semibold text-[#1D1D1F] dark:text-zinc-100">
                    Obsidian Deep RAG Synthesis
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={ragQueryInput}
                      onChange={(e) => setRagQueryInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleRunVaultRag();
                      }}
                      placeholder="Ask across your Second Brain vault..."
                      className="flex-1 min-w-0 h-8 bg-white dark:bg-[#09090C] border border-black/[0.08] dark:border-white/[0.09] rounded-[10px] px-2.5 text-xs text-[#1D1D1F] dark:text-zinc-200 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handleRunVaultRag()}
                      disabled={ragLoading}
                      className="studio-btn h-8 px-3 rounded-[10px] bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] text-xs font-semibold cursor-pointer shrink-0"
                    >
                      {ragLoading ? "Analyzing..." : "Ask Vault"}
                    </button>
                  </div>
                  {ragAnswer && (
                    <div className="p-3 rounded-[10px] bg-white dark:bg-[#09090C] border border-black/[0.06] dark:border-white/[0.07] text-xs leading-relaxed text-[#1D1D1F] dark:text-zinc-200 whitespace-pre-wrap">
                      {ragAnswer}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SUB-TAB 3: NŪS COMPANION MILESTONES */}
            {vaultSubTab === "milestones" && (
              <div className="rounded-[14px] border border-black/[0.07] dark:border-white/[0.08] bg-[#F8F8FA] dark:bg-[#0E0E12] p-3.5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-semibold text-[#1D1D1F] dark:text-zinc-100">
                      NŪS Companion · Milestones & Deadlines
                    </span>
                  </div>
                  <span className="font-mono text-[10.5px] text-[#6E6E73] dark:text-zinc-400 tabular-nums">
                    {milestones.filter((m) => m.status !== "done").length} active
                  </span>
                </div>

                <div className="flex items-center gap-1.5 z-20">
                  <input
                    type="text"
                    value={newMilestoneTitle}
                    onChange={(e) => setNewMilestoneTitle(e.target.value)}
                    placeholder="Add milestone or deadline..."
                    className="flex-1 min-w-0 h-8 bg-white dark:bg-[#09090C] border border-black/[0.08] dark:border-white/[0.09] focus:border-amber-500/60 rounded-[10px] px-2.5 text-xs text-[#1D1D1F] dark:text-zinc-200 outline-none transition-colors"
                  />
                  <StudioDropdown
                    value={newMilestonePriority}
                    options={PRIORITY_OPTIONS}
                    onChange={(val) =>
                      setNewMilestonePriority(val as "high" | "medium" | "low")
                    }
                    align="right"
                    className="w-[122px] shrink-0"
                    menuWidthClass="w-[175px]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newMilestoneTitle.trim()) return;
                      onAddMilestone({
                        title: newMilestoneTitle.trim(),
                        courseOrProject: newMilestoneCourse,
                        dueDate: new Date(Date.now() + 4 * 86400000)
                          .toISOString()
                          .slice(0, 10),
                        priority: newMilestonePriority,
                      });
                      setNewMilestoneTitle("");
                    }}
                    className="studio-btn h-8 px-2.5 rounded-[10px] bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>

                <div className="divide-y divide-black/[0.05] dark:divide-white/[0.06] rounded-[10px] border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-[#09090C]">
                  <AnimatePresence initial={false}>
                    {milestones.map((m) => {
                      const nextStatus =
                        m.status === "todo"
                          ? "in_progress"
                          : m.status === "in_progress"
                          ? "done"
                          : "todo";
                      return (
                        <motion.div
                          key={m.id}
                          layout
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                          className="p-2.5 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div
                              className={`font-medium truncate transition-colors ${
                                m.status === "done"
                                  ? "line-through text-[#8E8E93] dark:text-zinc-500"
                                  : "text-[#1D1D1F] dark:text-zinc-100"
                              }`}
                            >
                              {m.title}
                            </div>
                            <div className="text-[10.5px] text-[#6E6E73] dark:text-zinc-500 font-mono mt-0.5">
                              {m.courseOrProject} · {m.dueDate} · {m.priority}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateMilestoneStatus(m.id, nextStatus)
                              }
                              className={`studio-btn px-2 py-0.5 rounded-[7px] font-mono text-[10.5px] cursor-pointer ${
                                m.status === "done"
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                  : m.status === "in_progress"
                                  ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                                  : "bg-black/[0.06] dark:bg-white/[0.08] text-[#1D1D1F] dark:text-zinc-300"
                              }`}
                            >
                              {m.status}
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteMilestone(m.id)}
                              aria-label="Delete milestone"
                              className="studio-btn p-1 text-[#8E8E93] hover:text-rose-500 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
};
