import fs from "node:fs/promises";
import path from "node:path";

export interface SessionTurn {
  id: number;
  session_id: string;
  timestamp: string;
  user_text: string;
  intent: string | null;
  agent_output: string;
  final_response: string;
  round_trip_ms: number;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastIntent: string | null;
  turns: SessionTurn[];
}

const SESSIONS_FILE = path.resolve(process.cwd(), "data", "sessions.json");

const SEEDED_SESSIONS: ChatSession[] = [
  {
    id: "sess-codex-jev-router",
    title: "Refactor Jev System-1 Reflex Router",
    createdAt: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    lastIntent: "codex_diff",
    turns: [
      {
        id: 1,
        session_id: "sess-codex-jev-router",
        timestamp: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
        user_text:
          "Refactor jevReflexRouter.ts to add speculative @ref pre-fetching and latency histograms",
        intent: "codex_diff",
        agent_output: "Generated unified diff patch for src/harness/jevReflexRouter.ts",
        final_response:
          "I analyzed `src/harness/jevReflexRouter.ts` and staged a unified diff in the **Diff Outbox** that adds a sub-15ms speculative `@ref` lookahead cache and p50/p99 latency telemetry counters. You can review and approve the patch directly from the Diffs inspector.",
        round_trip_ms: 18,
      },
    ],
  },
  {
    id: "sess-agent-desktop-ci",
    title: "Automate @e4 CI Runner via Agent-Desktop",
    createdAt: new Date(Date.now() - 3600 * 1000 * 18).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 16).toISOString(),
    lastIntent: "agent_desktop",
    turns: [
      {
        id: 2,
        session_id: "sess-agent-desktop-ci",
        timestamp: new Date(Date.now() - 3600 * 1000 * 18).toISOString(),
        user_text:
          "Click @e4 to execute the CI verification suite in the Codex Build & Test Runner window",
        intent: "agent_desktop",
        agent_output: "Executed click on @e4 (Run Command button)",
        final_response:
          "Targeted semantic node `@e4` (`button: Run Command`) inside `win-codex-runner` via the `vercel-labs/agent-desktop` accessibility tree. All 42 harness checks passed in 14ms.",
        round_trip_ms: 11,
      },
    ],
  },
  {
    id: "sess-nus-architecture",
    title: "OpenJarvis 5-Primitive Sprint & Vault Sync",
    createdAt: new Date(Date.now() - 3600 * 1000 * 36).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 30).toISOString(),
    lastIntent: "nus_organizer",
    turns: [
      {
        id: 3,
        session_id: "sess-nus-architecture",
        timestamp: new Date(Date.now() - 3600 * 1000 * 36).toISOString(),
        user_text:
          "Summarize our OpenJarvis 5-primitive architecture notes and schedule the benchmark milestone",
        intent: "nus_organizer",
        agent_output: "Synced Obsidian Second Brain & NŪS Companion milestones",
        final_response:
          "I cross-referenced your Obsidian Second Brain vault (`OpenJarvis-Architecture.md`) across all 5 primitives (Intelligence, Engine, Agentic Logic, Tools & Memory, Learning) and logged the high-priority benchmark milestone in NŪS Companion.",
        round_trip_ms: 24,
      },
    ],
  },
];

class PersistentSessionMemory {
  private sessions: ChatSession[] = [];
  private nextTurnId = 100;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      await fs.mkdir(path.dirname(SESSIONS_FILE), { recursive: true });
      const raw = await fs.readFile(SESSIONS_FILE, "utf-8");
      const parsed = JSON.parse(raw) as ChatSession[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure every turn across all sessions has a strictly unique monotonic ID
        let runningId = 1;
        for (const sess of parsed) {
          if (Array.isArray(sess.turns)) {
            for (const turn of sess.turns) {
              turn.id = runningId++;
            }
          } else {
            sess.turns = [];
          }
        }
        this.nextTurnId = Math.max(100, runningId + 1);
        this.sessions = parsed;
        await this.persist();
      } else {
        this.sessions = structuredClone(SEEDED_SESSIONS);
        this.nextTurnId = 100;
        await this.persist();
      }
    } catch {
      this.sessions = structuredClone(SEEDED_SESSIONS);
      this.nextTurnId = 100;
      await this.persist();
    }
    this.initialized = true;
  }

  private async persist(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(SESSIONS_FILE), { recursive: true });
      await fs.writeFile(
        SESSIONS_FILE,
        JSON.stringify(this.sessions, null, 2),
        "utf-8"
      );
    } catch {
      // Ignore write error in restricted fs
    }
  }

  async listSessions(): Promise<
    Array<{
      id: string;
      title: string;
      createdAt: string;
      updatedAt: string;
      lastIntent: string | null;
      turnCount: number;
      preview: string;
    }>
  > {
    await this.init();
    return [...this.sessions]
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      .map((s) => ({
        id: s.id,
        title: s.title,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        lastIntent: s.lastIntent,
        turnCount: s.turns.length,
        preview:
          s.turns[s.turns.length - 1]?.user_text ||
          "Empty studio conversation thread",
      }));
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    await this.init();
    return this.sessions.find((s) => s.id === sessionId) || null;
  }

  async createSession(title = "New Studio Thread"): Promise<ChatSession> {
    await this.init();
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim() || "New Studio Thread",
      createdAt: now,
      updatedAt: now,
      lastIntent: null,
      turns: [],
    };
    this.sessions.unshift(session);
    await this.persist();
    return session;
  }

  async renameSession(
    sessionId: string,
    title: string
  ): Promise<ChatSession | null> {
    await this.init();
    const target = this.sessions.find((s) => s.id === sessionId);
    if (!target) return null;
    target.title = title.trim() || target.title;
    target.updatedAt = new Date().toISOString();
    await this.persist();
    return target;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    await this.init();
    const before = this.sessions.length;
    this.sessions = this.sessions.filter((s) => s.id !== sessionId);
    await this.persist();
    return this.sessions.length < before;
  }

  async logTurn(params: {
    sessionId: string;
    userText: string;
    intent: string | null;
    agentOutput: string;
    finalResponse: string;
    roundTripMs?: number;
  }): Promise<SessionTurn> {
    await this.init();
    let session = this.sessions.find((s) => s.id === params.sessionId);
    if (!session) {
      session = await this.createSession(
        params.userText.slice(0, 44).trim() || "Studio Thread"
      );
    } else if (
      session.turns.length === 0 &&
      (session.title === "New Studio Thread" || !session.title)
    ) {
      session.title =
        params.userText.length > 44
          ? `${params.userText.slice(0, 42).trim()}…`
          : params.userText.trim();
    }

    const turn: SessionTurn = {
      id: this.nextTurnId++,
      session_id: session.id,
      timestamp: new Date().toISOString(),
      user_text: params.userText,
      intent: params.intent,
      agent_output: params.agentOutput,
      final_response: params.finalResponse,
      round_trip_ms: Math.round(params.roundTripMs ?? 0),
    };

    session.turns.push(turn);
    session.updatedAt = turn.timestamp;
    session.lastIntent = params.intent;
    await this.persist();
    return turn;
  }

  async getRecent(limit = 50): Promise<SessionTurn[]> {
    await this.init();
    const latest = this.sessions[0];
    if (!latest) return [];
    return latest.turns.slice(-limit);
  }

  async clear(): Promise<void> {
    await this.init();
    if (this.sessions[0]) {
      this.sessions[0].turns = [];
      await this.persist();
    }
  }
}

export const sessionMemory = new PersistentSessionMemory();
