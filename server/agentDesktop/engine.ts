import {
  AccessibilityNode,
  AgentDesktopCommand,
  AgentDesktopEnvelope,
} from "../brain/state.ts";

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

class AgentDesktopEngine {
  private state: SandboxAppState = {
    activeWindowId: "win-codex-runner",
    lastFocusedRef: "@e3",
    terminalInput: "npm run test:agent-harness",
    terminalLastOutput: "PASS  src/harness/jev-reflex.spec.ts (142ms) — 18 assertions verified.",
    testSuitePassed: true,
    buildTarget: "production",
    autoDeployEnabled: true,
    quickNoteTitle: "OpenJarvis + Jev Architecture Spec",
    quickNoteBody:
      "System-1 Jev reflex handles <200ms intent triage and @ref actions; System-2 OpenJarvis synthesizes deep code diffs.",
    searchFilter: "agent-desktop",
    localBridgeConnected: false,
    localBridgeHost: "ws://127.0.0.1:44820",
    actionHistory: [
      {
        id: "act-init-1",
        timestamp: new Date().toISOString(),
        command: "snapshot",
        summary: "Indexed 18 accessibility tree nodes (@e1..@e18) across 3 desktop surfaces",
      },
    ],
  };

  private externalLocalTree: AccessibilityNode[] | null = null;

  public getSandboxState(): SandboxAppState {
    return { ...this.state };
  }

  public configureLocalBridge(opts: {
    connected: boolean;
    host?: string;
    externalTree?: AccessibilityNode[];
  }): SandboxAppState {
    this.state.localBridgeConnected = opts.connected;
    if (opts.host) {
      this.state.localBridgeHost = opts.host;
    }
    if (opts.externalTree) {
      this.externalLocalTree = opts.externalTree;
    }
    return this.getSandboxState();
  }

  public getSnapshot(): AccessibilityNode[] {
    if (this.state.localBridgeConnected && this.externalLocalTree) {
      return this.externalLocalTree;
    }

    const s = this.state;
    return [
      {
        ref: "@e1",
        role: "window",
        name: "Codex Build & Test Runner",
        value: s.activeWindowId === "win-codex-runner" ? "Active Window" : "Background",
        enabled: true,
        focused: s.activeWindowId === "win-codex-runner",
        windowId: "win-codex-runner",
        bounds: { x: 16, y: 16, width: 520, height: 260 },
        children: [
          {
            ref: "@e2",
            role: "tab",
            name: "Switch to Build & Test Runner Window",
            value: String(s.activeWindowId === "win-codex-runner"),
            enabled: true,
            focused: s.lastFocusedRef === "@e2",
            windowId: "win-codex-runner",
            bounds: { x: 24, y: 24, width: 160, height: 32 },
          },
          {
            ref: "@e3",
            role: "textfield",
            name: "CI Command Input",
            value: s.terminalInput,
            description: "Command string to execute inside the Codex sandbox runner",
            enabled: true,
            focused: s.lastFocusedRef === "@e3",
            windowId: "win-codex-runner",
            bounds: { x: 24, y: 68, width: 360, height: 36 },
          },
          {
            ref: "@e4",
            role: "button",
            name: "Run CI Command",
            value: "Execute",
            description: "Executes the command in @e3 and updates status @e7",
            enabled: true,
            focused: s.lastFocusedRef === "@e4",
            windowId: "win-codex-runner",
            bounds: { x: 396, y: 68, width: 120, height: 36 },
          },
          {
            ref: "@e5",
            role: "checkbox",
            name: "Auto-Deploy on Green Build",
            value: s.autoDeployEnabled ? "checked" : "unchecked",
            enabled: true,
            focused: s.lastFocusedRef === "@e5",
            windowId: "win-codex-runner",
            bounds: { x: 24, y: 118, width: 220, height: 28 },
          },
          {
            ref: "@e6",
            role: "button",
            name: "Toggle Build Target (Dev / Prod)",
            value: s.buildTarget,
            enabled: true,
            focused: s.lastFocusedRef === "@e6",
            windowId: "win-codex-runner",
            bounds: { x: 260, y: 118, width: 180, height: 28 },
          },
          {
            ref: "@e7",
            role: "status",
            name: "Runner Output Status",
            value: s.terminalLastOutput,
            enabled: true,
            focused: s.lastFocusedRef === "@e7",
            windowId: "win-codex-runner",
            bounds: { x: 24, y: 160, width: 492, height: 76 },
          },
        ],
      },
      {
        ref: "@e8",
        role: "window",
        name: "NŪS Companion Quick Scratchpad",
        value: s.activeWindowId === "win-nus-planner" ? "Active Window" : "Background",
        enabled: true,
        focused: s.activeWindowId === "win-nus-planner",
        windowId: "win-nus-planner",
        bounds: { x: 16, y: 290, width: 520, height: 220 },
        children: [
          {
            ref: "@e9",
            role: "tab",
            name: "Switch to NŪS Scratchpad Window",
            value: String(s.activeWindowId === "win-nus-planner"),
            enabled: true,
            focused: s.lastFocusedRef === "@e9",
            windowId: "win-nus-planner",
            bounds: { x: 24, y: 298, width: 160, height: 32 },
          },
          {
            ref: "@e10",
            role: "textfield",
            name: "Scratchpad Note Title",
            value: s.quickNoteTitle,
            enabled: true,
            focused: s.lastFocusedRef === "@e10",
            windowId: "win-nus-planner",
            bounds: { x: 24, y: 340, width: 492, height: 34 },
          },
          {
            ref: "@e11",
            role: "codeeditor",
            name: "Scratchpad Markdown Body",
            value: s.quickNoteBody,
            enabled: true,
            focused: s.lastFocusedRef === "@e11",
            windowId: "win-nus-planner",
            bounds: { x: 24, y: 384, width: 370, height: 96 },
          },
          {
            ref: "@e12",
            role: "button",
            name: "Sync Note to Obsidian Vault",
            value: "Commit Note",
            enabled: true,
            focused: s.lastFocusedRef === "@e12",
            windowId: "win-nus-planner",
            bounds: { x: 404, y: 384, width: 112, height: 42 },
          },
          {
            ref: "@e13",
            role: "button",
            name: "Clear Scratchpad",
            value: "Reset",
            enabled: true,
            focused: s.lastFocusedRef === "@e13",
            windowId: "win-nus-planner",
            bounds: { x: 404, y: 436, width: 112, height: 42 },
          },
        ],
      },
      {
        ref: "@e14",
        role: "window",
        name: "Inspector Filter & Quick Actions",
        value: s.activeWindowId === "win-browser-preview" ? "Active Window" : "Background",
        enabled: true,
        focused: s.activeWindowId === "win-browser-preview",
        windowId: "win-browser-preview",
        bounds: { x: 16, y: 524, width: 520, height: 140 },
        children: [
          {
            ref: "@e15",
            role: "tab",
            name: "Switch to Inspector Window",
            value: String(s.activeWindowId === "win-browser-preview"),
            enabled: true,
            focused: s.lastFocusedRef === "@e15",
            windowId: "win-browser-preview",
            bounds: { x: 24, y: 532, width: 150, height: 30 },
          },
          {
            ref: "@e16",
            role: "textfield",
            name: "Accessibility Tree Filter Query",
            value: s.searchFilter,
            enabled: true,
            focused: s.lastFocusedRef === "@e16",
            windowId: "win-browser-preview",
            bounds: { x: 24, y: 572, width: 340, height: 34 },
          },
          {
            ref: "@e17",
            role: "button",
            name: "Refresh Accessibility Snapshot",
            value: "Snapshot",
            enabled: true,
            focused: s.lastFocusedRef === "@e17",
            windowId: "win-browser-preview",
            bounds: { x: 376, y: 572, width: 140, height: 34 },
          },
        ],
      },
    ];
  }

  public flattenNodes(nodes: AccessibilityNode[] = this.getSnapshot()): AccessibilityNode[] {
    const list: AccessibilityNode[] = [];
    for (const n of nodes) {
      list.push(n);
      if (n.children && n.children.length > 0) {
        list.push(...this.flattenNodes(n.children));
      }
    }
    return list;
  }

  public executeCommand(cmd: AgentDesktopCommand): AgentDesktopEnvelope {
    const mode = this.state.localBridgeConnected ? "local_cli_bridge" : "web_sandbox";
    const ref = cmd.ref?.startsWith("@") ? cmd.ref : cmd.ref ? `@${cmd.ref}` : undefined;
    const allNodes = this.flattenNodes();
    const targetNode = ref ? allNodes.find((n) => n.ref.toLowerCase() === ref.toLowerCase()) : undefined;

    let summary = "";

    if (cmd.command === "snapshot") {
      summary = `agent-desktop snapshot -> captured ${allNodes.length} semantic nodes with stable @ref handles`;
    } else if (!targetNode && ref) {
      summary = `Ref ${ref} not found in current accessibility tree (${allNodes.length} nodes available).`;
      return {
        ok: false,
        mode,
        command: cmd.command,
        targetRef: ref,
        summary,
        timestamp: new Date().toISOString(),
        activeWindowId: this.state.activeWindowId,
        snapshot: this.getSnapshot(),
      };
    } else if (targetNode) {
      this.state.lastFocusedRef = targetNode.ref;
      this.state.activeWindowId = targetNode.windowId as SandboxAppState["activeWindowId"];

      if (cmd.command === "focus") {
        summary = `Focused ${targetNode.ref} (${targetNode.role} "${targetNode.name}") in ${targetNode.windowId}`;
      } else if (cmd.command === "click") {
        summary = this.handleRefClick(targetNode);
      } else if (cmd.command === "type") {
        const text = cmd.text ?? "";
        summary = this.handleRefType(targetNode, text);
      } else if (cmd.command === "press") {
        const key = cmd.key || "Enter";
        summary = `Sent key '${key}' to ${targetNode.ref} (${targetNode.name})`;
        if (key.toLowerCase() === "enter" && targetNode.ref === "@e3") {
          this.handleRefClick(allNodes.find((n) => n.ref === "@e4")!);
        }
      }
    } else {
      summary = `Executed ${cmd.command} on active desktop window (${this.state.activeWindowId})`;
    }

    this.state.actionHistory.unshift({
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      command: cmd.command,
      ref: targetNode?.ref,
      value: cmd.text || cmd.key,
      summary,
    });
    this.state.actionHistory = this.state.actionHistory.slice(0, 40);

    return {
      ok: true,
      mode,
      command: cmd.command,
      targetRef: targetNode?.ref,
      summary,
      timestamp: new Date().toISOString(),
      activeWindowId: this.state.activeWindowId,
      highlightedRef: targetNode?.ref,
      snapshot: this.getSnapshot(),
    };
  }

  private handleRefClick(node: AccessibilityNode): string {
    switch (node.ref) {
      case "@e1":
      case "@e2":
        this.state.activeWindowId = "win-codex-runner";
        return `Activated window 'Codex Build & Test Runner' (${node.ref})`;
      case "@e4":
        this.state.testSuitePassed = true;
        this.state.terminalLastOutput = `[${new Date().toLocaleTimeString()}] $ ${this.state.terminalInput} -> EXIT 0 (21 passed, 0 failed in 118ms)`;
        return `Clicked @e4 'Run CI Command' -> executed '${this.state.terminalInput}' with EXIT 0`;
      case "@e5":
        this.state.autoDeployEnabled = !this.state.autoDeployEnabled;
        return `Toggled @e5 'Auto-Deploy on Green Build' -> ${this.state.autoDeployEnabled ? "checked" : "unchecked"}`;
      case "@e6":
        this.state.buildTarget =
          this.state.buildTarget === "production" ? "development" : "production";
        return `Clicked @e6 'Toggle Build Target' -> now '${this.state.buildTarget}'`;
      case "@e8":
      case "@e9":
        this.state.activeWindowId = "win-nus-planner";
        return `Activated window 'NŪS Companion Quick Scratchpad' (${node.ref})`;
      case "@e12":
        return `Clicked @e12 'Sync Note to Obsidian Vault' -> queued '${this.state.quickNoteTitle}.md'`;
      case "@e13":
        this.state.quickNoteBody = "";
        return `Clicked @e13 'Clear Scratchpad' -> cleared editor buffer`;
      case "@e14":
      case "@e15":
        this.state.activeWindowId = "win-browser-preview";
        return `Activated window 'Inspector Filter & Quick Actions' (${node.ref})`;
      case "@e17":
        return `Clicked @e17 'Refresh Accessibility Snapshot' -> re-indexed 17 nodes`;
      default:
        return `Clicked ${node.ref} (${node.role} "${node.name}")`;
    }
  }

  private handleRefType(node: AccessibilityNode, text: string): string {
    switch (node.ref) {
      case "@e3":
        this.state.terminalInput = text;
        return `Typed "${text}" into @e3 'CI Command Input'`;
      case "@e10":
        this.state.quickNoteTitle = text;
        return `Typed "${text}" into @e10 'Scratchpad Note Title'`;
      case "@e11":
        this.state.quickNoteBody = text;
        return `Typed ${text.length} chars into @e11 'Scratchpad Markdown Body'`;
      case "@e16":
        this.state.searchFilter = text;
        return `Typed "${text}" into @e16 'Accessibility Tree Filter Query'`;
      default:
        return `Typed "${text}" into ${node.ref} (${node.name})`;
    }
  }
}

export const agentDesktopEngine = new AgentDesktopEngine();
