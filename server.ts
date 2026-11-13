import "dotenv/config";
import express from "express";
import { execSync } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { WebSocket, WebSocketServer } from "ws";
import { createServer as createViteServer } from "vite";
import { agentDesktopEngine } from "./server/agentDesktop/engine.ts";
import { Supervisor } from "./server/brain/supervisor.ts";
import {
  AccessibilityNode,
  AgentDesktopCommand,
  PipelineEvent,
} from "./server/brain/state.ts";
import { codexWorkspace } from "./server/codex/workspace.ts";
import {
  getProviderKeyStatus,
  getSettings,
  LLMProvider,
  OSBackend,
  ThinkingMode,
  updateSettings,
} from "./server/config.ts";
import { ObsidianMemory } from "./server/memory/obsidian.ts";
import { sessionMemory } from "./server/memory/session.ts";
import { nusOrganizer } from "./server/nus/organizer.ts";
import { JarvisPipeline } from "./server/transport/pipeline.ts";
import { STT } from "./server/transport/stt.ts";
import { JarvisTTS } from "./server/transport/tts.ts";

const PORT = 3000;
const HOST = "0.0.0.0";

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  const clients = new Set<WebSocket>();
  function broadcast(payload: Record<string, unknown>) {
    const data = JSON.stringify(payload);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  // Initialize J.A.R.V.I.S v3.0 subsystems
  await sessionMemory.init();
  const supervisor = new Supervisor();
  await supervisor.build();
  const sttService = new STT();
  const ttsService = new JarvisTTS();

  const pipeline = new JarvisPipeline({
    supervisor,
    stt: sttService,
    tts: ttsService,
    onEvent: (event: PipelineEvent) => {
      broadcast({
        type: "state",
        state: event.state,
        pillMood: event.pillMood,
        ...event.data,
      });
    },
    onJevReflex: (decision) => {
      broadcast({
        type: "jev_reflex",
        decision,
      });
    },
    onStep: (step, pillMood) => {
      broadcast({
        type: "trace_step",
        step,
        pillMood,
      });
    },
    onTerminalLog: (entry) => {
      broadcast({
        type: "terminal_log",
        entry,
      });
    },
  });

  httpServer.on("upgrade", (req, socket, head) => {
    const urlPath = req.url?.split("?")[0];
    if (urlPath === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => {
      clients.delete(ws);
    });
    ws.on("message", async (rawData, isBinary) => {
      try {
        if (isBinary) {
          const audioBuffer = Buffer.isBuffer(rawData)
            ? rawData
            : Buffer.from(rawData as ArrayBuffer);
          if (audioBuffer.length === 0) return;

          const result = await pipeline.processAudio(
            audioBuffer,
            "audio/webm",
            async (partial) => {
              await sessionMemory.logTurn({
                sessionId: partial.sessionId,
                userText: partial.userText,
                intent: partial.intent,
                agentOutput: partial.agentOutput,
                finalResponse: partial.response,
                roundTripMs: partial.roundTripMs,
              });
              broadcast({
                type: "response",
                source: "audio",
                sessionId: partial.sessionId,
                user_text: partial.userText,
                response: partial.response,
                intent: partial.intent,
                round_trip_ms: partial.roundTripMs,
                sources: partial.sources,
                jevDecision: partial.jevDecision,
                trace: partial.trace,
                codeDiff: partial.codeDiff,
                desktopEnvelope: partial.desktopEnvelope,
                tts_enabled: getSettings().ttsEnabled,
              });
            }
          );
          if (!result) return;

          if (result.audioBase64) {
            broadcast({
              type: "tts_audio",
              data: result.audioBase64,
            });
          }
          return;
        }

        const msg = JSON.parse(rawData.toString("utf-8")) as {
          type?: string;
          text?: string;
          sessionId?: string;
        };
        if (msg.type === "text_input" && msg.text?.trim()) {
          const userText = msg.text.trim();
          const targetSessionId = msg.sessionId || "sess-codex-jev-router";
          const result = await pipeline.processText(
            userText,
            async (partial) => {
              await sessionMemory.logTurn({
                sessionId: targetSessionId,
                userText,
                intent: partial.intent,
                agentOutput: partial.agentOutput,
                finalResponse: partial.response,
                roundTripMs: partial.roundTripMs,
              });
              broadcast({
                type: "response",
                source: "text",
                sessionId: targetSessionId,
                user_text: userText,
                response: partial.response,
                intent: partial.intent,
                round_trip_ms: partial.roundTripMs,
                sources: partial.sources,
                jevDecision: partial.jevDecision,
                trace: partial.trace,
                codeDiff: partial.codeDiff,
                desktopEnvelope: partial.desktopEnvelope,
                tts_enabled: getSettings().ttsEnabled,
              });
            },
            { sessionId: targetSessionId }
          );

          if (result.audioBase64) {
            broadcast({
              type: "tts_audio",
              data: result.audioBase64,
            });
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        broadcast({ type: "error", message });
      }
    });
  });

  // ── Core Status, Multi-Session Memory & History Routes ────────────────────
  app.get("/api/status", (_req, res) => {
    const s = getSettings();
    res.json({
      status: "online",
      version: "3.0.0",
      release: "V3",
      engine: "OpenJarvis 5-Primitive + Jev System-1 Reflex + Agent-Desktop",
      runtime: "node-express-vite",
      models: {
        llmPrimary: s.geminiModel,
        llmFallback: "gemini-3.1-flash-lite + openjarvis-local-sys2",
        stt: "gemini-3.5-transcribe",
        tts: "gemini-3.8-flash-lite-tts",
      },
    });
  });

  app.get("/api/sessions", async (_req, res) => {
    const sessions = await sessionMemory.listSessions();
    res.json({ sessions });
  });

  app.post("/api/sessions", async (req, res) => {
    const { title } = req.body as { title?: string };
    const session = await sessionMemory.createSession(title);
    const sessions = await sessionMemory.listSessions();
    res.json({ session, sessions });
  });

  app.get("/api/sessions/:id", async (req, res) => {
    const session = await sessionMemory.getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json({ session });
  });

  app.patch("/api/sessions/:id", async (req, res) => {
    const { title } = req.body as { title?: string };
    if (!title?.trim()) {
      res.status(400).json({ error: "Title required" });
      return;
    }
    const session = await sessionMemory.renameSession(req.params.id, title);
    const sessions = await sessionMemory.listSessions();
    res.json({ session, sessions });
  });

  app.delete("/api/sessions/:id", async (req, res) => {
    await sessionMemory.deleteSession(req.params.id);
    const sessions = await sessionMemory.listSessions();
    res.json({ sessions });
  });

  app.get("/api/history", async (_req, res) => {
    const turns = await sessionMemory.getRecent(50);
    res.json({ turns });
  });

  app.delete("/api/history", async (_req, res) => {
    await sessionMemory.clear();
    res.json({ status: "cleared" });
  });

  // ── OpenJarvis Telemetry, Traces & Terminal Logs ─────────────────────────
  app.get("/api/openjarvis/telemetry", async (_req, res) => {
    const patches = await codexWorkspace.getPatches();
    const files = await codexWorkspace.listFiles();
    res.json({
      traces: supervisor.getTraces(25),
      terminalLogs: supervisor.getTerminalLogs(60),
      patches,
      files,
      milestones: nusOrganizer.listMilestones(),
      desktopState: agentDesktopEngine.getSandboxState(),
      accessibilityTree: agentDesktopEngine.getSnapshot(),
    });
  });

  // ── vercel-labs/agent-desktop Routes (Web Sandbox + Local CLI Bridge) ────
  app.get("/api/agent-desktop/snapshot", (_req, res) => {
    res.json({
      state: agentDesktopEngine.getSandboxState(),
      snapshot: agentDesktopEngine.getSnapshot(),
    });
  });

  app.post("/api/agent-desktop/act", async (req, res) => {
    const body = req.body as AgentDesktopCommand;
    const envelope = agentDesktopEngine.executeCommand(body);

    // If @e12 ("Sync Note to Obsidian Vault") is clicked, persist note to Vault
    let vaultNotes;
    if (envelope.targetRef === "@e12" && body.command === "click") {
      const sb = agentDesktopEngine.getSandboxState();
      const obsidian = new ObsidianMemory();
      const noteMsg = await obsidian.writeNote(
        sb.quickNoteTitle || "NŪS Scratchpad Note",
        sb.quickNoteBody || "Synced via @e12 agent-desktop action.",
        false
      );
      envelope.summary = `${envelope.summary} (${noteMsg})`;
      vaultNotes = await obsidian.listNotes();
    }

    const logEntry = supervisor.pushTerminalLog({
      subsystem: "AGENT-DESKTOP",
      command: `agent-desktop ${body.command}${body.ref ? ` --ref ${body.ref}` : ""}${body.text ? ` --text "${body.text}"` : ""}`,
      output: envelope.summary,
      status: envelope.ok ? "ok" : "warn",
    });
    broadcast({
      type: "agent_desktop_update",
      envelope,
      sandboxState: agentDesktopEngine.getSandboxState(),
    });
    broadcast({
      type: "terminal_log",
      entry: logEntry,
    });
    res.json({
      envelope,
      sandboxState: agentDesktopEngine.getSandboxState(),
      notes: vaultNotes,
    });
  });

  app.post("/api/agent-desktop/bridge", (req, res) => {
    const body = req.body as {
      connected: boolean;
      host?: string;
      externalTree?: AccessibilityNode[];
    };
    const updated = agentDesktopEngine.configureLocalBridge(body);
    const logEntry = supervisor.pushTerminalLog({
      subsystem: "AGENT-DESKTOP",
      command: `agent-desktop bridge --connect=${body.connected} --host=${updated.localBridgeHost}`,
      output: body.connected
        ? `Connected Local CLI Bridge (${updated.localBridgeHost})`
        : "Switched to built-in Interactive Web Sandbox mode",
      status: "ok",
    });
    broadcast({
      type: "terminal_log",
      entry: logEntry,
    });
    res.json({
      sandboxState: updated,
      snapshot: agentDesktopEngine.getSnapshot(),
    });
  });

  // ── Codex Workspace & Diff Routes ────────────────────────────────────────
  app.get("/api/codex/files", async (_req, res) => {
    const files = await codexWorkspace.listFiles();
    const patches = await codexWorkspace.getPatches();
    res.json({ files, patches });
  });

  app.post("/api/codex/apply-diff", async (req, res) => {
    const { patchId } = req.body as { patchId: string };
    const applied = await codexWorkspace.applyPatch(patchId);
    if (!applied) {
      res.status(404).json({ error: "Patch not found" });
      return;
    }
    const logEntry = supervisor.pushTerminalLog({
      subsystem: "CODEX-DIFF",
      command: `git apply ${applied.id} (${applied.filePath})`,
      output: `Applied +${applied.additions} / -${applied.deletions} lines to ${applied.filePath}`,
      status: "ok",
    });
    broadcast({ type: "terminal_log", entry: logEntry });
    res.json({ patch: applied, files: await codexWorkspace.listFiles() });
  });

  app.post("/api/codex/revert-diff", async (req, res) => {
    const { patchId } = req.body as { patchId: string };
    const reverted = await codexWorkspace.revertPatch(patchId);
    if (!reverted) {
      res.status(404).json({ error: "Patch not found" });
      return;
    }
    const logEntry = supervisor.pushTerminalLog({
      subsystem: "CODEX-DIFF",
      command: `git checkout -- ${reverted.filePath}`,
      output: `Reverted patch ${reverted.id} on ${reverted.filePath}`,
      status: "warn",
    });
    broadcast({ type: "terminal_log", entry: logEntry });
    res.json({ patch: reverted, files: await codexWorkspace.listFiles() });
  });

  // ── NŪS Companion Milestones Routes ──────────────────────────────────────
  app.get("/api/nus/milestones", (_req, res) => {
    res.json({ milestones: nusOrganizer.listMilestones() });
  });

  app.post("/api/nus/milestones", (req, res) => {
    const body = req.body as {
      title: string;
      courseOrProject?: string;
      dueDate?: string;
      priority?: "high" | "medium" | "low";
    };
    if (!body.title?.trim()) {
      res.status(400).json({ error: "Milestone title required" });
      return;
    }
    const created = nusOrganizer.addMilestone({
      title: body.title.trim(),
      courseOrProject: body.courseOrProject?.trim() || "Codex Sprint",
      dueDate:
        body.dueDate ||
        new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      priority: body.priority || "medium",
      status: "todo",
    });
    res.json({ milestone: created, milestones: nusOrganizer.listMilestones() });
  });

  app.patch("/api/nus/milestones/:id", (req, res) => {
    const { status } = req.body as { status: "todo" | "in_progress" | "done" };
    const updated = nusOrganizer.updateMilestoneStatus(req.params.id, status);
    if (!updated) {
      res.status(404).json({ error: "Milestone not found" });
      return;
    }
    res.json({ milestone: updated, milestones: nusOrganizer.listMilestones() });
  });

  app.delete("/api/nus/milestones/:id", (req, res) => {
    nusOrganizer.deleteMilestone(req.params.id);
    res.json({ milestones: nusOrganizer.listMilestones() });
  });

  // ── Voice Synthesis (TTS) & Transcription (STT) Endpoints ───────────────
  app.post("/api/voice/tts", async (req, res) => {
    const { text, fallbackCue = true } = req.body as {
      text?: string;
      fallbackCue?: boolean;
    };
    if (!text?.trim()) {
      res.status(400).json({ error: "Text required for TTS" });
      return;
    }
    const t0 = performance.now();
    const audioBase64 = await ttsService.synthesize(text.trim(), {
      fallbackCueOnQuota: fallbackCue,
    });
    res.json({
      ok: Boolean(audioBase64),
      provider: ttsService.lastProvider,
      mimeType: "audio/wav",
      audioBase64,
      latencyMs: Math.max(1, Math.round(performance.now() - t0)),
    });
  });

  app.post("/api/voice/stt", async (req, res) => {
    const { audioBase64, mimeType = "audio/wav" } = req.body as {
      audioBase64?: string;
      mimeType?: string;
    };
    if (!audioBase64) {
      res.status(400).json({ error: "audioBase64 required" });
      return;
    }
    const t0 = performance.now();
    const buf = Buffer.from(audioBase64, "base64");
    const transcript = await sttService.transcribeBytes(buf, mimeType);
    res.json({
      ok: Boolean(transcript),
      transcript,
      latencyMs: Math.max(1, Math.round(performance.now() - t0)),
    });
  });

  // ── Settings & Vault Routes ──────────────────────────────────────────────
  app.get("/api/settings", (_req, res) => {
    const s = getSettings();
    const keys = getProviderKeyStatus();
    res.json({
      provider: s.llmProvider,
      flash_model: s.geminiModel,
      thinking_mode: s.thinkingMode,
      tts_enabled: s.ttsEnabled,
      tts_voice: s.ttsVoice,
      tts_lang: s.ttsLang,
      os_backend: s.osBackend,
      ...keys,
    });
  });

  app.post("/api/settings", (req, res) => {
    const body = req.body as {
      provider?: LLMProvider;
      thinking_mode?: ThinkingMode;
      tts_enabled?: boolean;
      tts_voice?: string;
      tts_lang?: string;
      os_backend?: OSBackend;
    };

    const updated = updateSettings({
      llmProvider: body.provider,
      thinkingMode: body.thinking_mode,
      ttsEnabled: body.tts_enabled,
      ttsVoice: body.tts_voice,
      ttsLang: body.tts_lang,
      osBackend: body.os_backend,
    });

    res.json({
      status: "ok",
      provider: updated.llmProvider,
      flash_model: updated.geminiModel,
      thinking_mode: updated.thinkingMode,
      tts_enabled: updated.ttsEnabled,
      tts_voice: updated.ttsVoice,
      os_backend: updated.osBackend,
    });
  });

  app.get("/api/vault", async (_req, res) => {
    try {
      const obsidian = new ObsidianMemory();
      const notes = await obsidian.listNotes();
      res.json({ notes });
    } catch (err) {
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/vault", async (req, res) => {
    try {
      const { title, content } = req.body as {
        title?: string;
        content?: string;
      };
      if (!title?.trim()) {
        res.status(400).json({ error: "Note title required" });
        return;
      }
      const obsidian = new ObsidianMemory();
      const msg = await obsidian.writeNote(title.trim(), content || "", false);
      const notes = await obsidian.listNotes();
      res.json({ message: msg, notes });
    } catch (err) {
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { text, sessionId, includeAudio } = req.body as {
        text?: string;
        sessionId?: string;
        includeAudio?: boolean;
      };
      if (!text?.trim()) {
        res.status(400).json({ error: "Text is required" });
        return;
      }
      const targetSessionId = sessionId || "sess-codex-jev-router";
      const result = await pipeline.processText(text.trim(), undefined, {
        sessionId: targetSessionId,
        skipBlockingTts: !includeAudio,
      });
      await sessionMemory.logTurn({
        sessionId: targetSessionId,
        userText: text.trim(),
        intent: result.intent,
        agentOutput: result.agentOutput,
        finalResponse: result.response,
        roundTripMs: result.roundTripMs,
      });
      res.json({
        ...result,
        sessionId: targetSessionId,
        tts_enabled: getSettings().ttsEnabled,
      });
    } catch (err) {
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ── GitHub Release V3 Push & Publisher Endpoint ──────────────────────────
  app.post("/api/github/release", async (req, res) => {
    const repo =
      (req.body as { repo?: string })?.repo || "ManasSoni-2009/Project-JARVIS";
    const tag = "v3.0.0";
    const releaseName =
      "J.A.R.V.I.S v3.0 (Release V3) — OpenJarvis + Jev Reflex + Hedwig Studio";

    const token =
      process.env.GITHUB_TOKEN ||
      process.env.GH_TOKEN ||
      process.env.GITHUB_SECRET ||
      process.env.GITHUB_PAT;

    let gitCommit = "unknown";
    let gitTagVerified = false;
    let gitPushed = false;
    let pushOutput = "";

    try {
      execSync("git config --global --add safe.directory /app/applet");
      execSync('git config user.name "ManasSoni-2009"');
      execSync('git config user.email "manassoni009@gmail.com"');
      const statusOut = execSync("git status --porcelain").toString().trim();
      if (statusOut) {
        execSync("git add -A");
        execSync(
          'git commit -m "docs(v3): update README installation guide, V3 tech stack, and release configuration"'
        );
      }
      execSync('git tag -f -a v3.0.0 -m "J.A.R.V.I.S Release v3.0.0"');
      execSync('git tag -f -a V3 -m "J.A.R.V.I.S Release V3"');
      gitCommit = execSync("git rev-parse --short HEAD").toString().trim();
      const tags = execSync("git tag -l").toString().split("\n");
      gitTagVerified = tags.includes("v3.0.0") && tags.includes("V3");
    } catch (gitErr) {
      pushOutput = gitErr instanceof Error ? gitErr.message : String(gitErr);
    }

    if (!token) {
      res.json({
        ok: true,
        mode: "local-git-tagged",
        repo,
        tag,
        commit: gitCommit,
        gitTagVerified,
        gitPushed: false,
        message:
          "Local Git repository committed and tagged as v3.0.0 (V3). Add GITHUB_TOKEN in Settings > Secrets to push to GitHub.",
      });
      return;
    }

    const publicRemote = `https://github.com/${repo}.git`;
    const authRemote = `https://x-access-token:${token}@github.com/${repo}.git`;

    try {
      execSync(`git remote set-url origin "${authRemote}"`);
      execSync("git push origin main --force", { stdio: "pipe" });
      execSync("git push origin v3.0.0 --force", { stdio: "pipe" });
      execSync("git push origin V3 --force", { stdio: "pipe" });
      gitPushed = true;
      pushOutput = "Pushed branch 'main' and tags 'v3.0.0', 'V3' to origin.";
    } catch (pushErr) {
      const rawMsg =
        pushErr instanceof Error ? pushErr.message : String(pushErr);
      pushOutput = rawMsg.replace(new RegExp(token, "g"), "***");
    } finally {
      try {
        execSync(`git remote set-url origin "${publicRemote}"`);
      } catch {
        // ignore
      }
    }

    const releaseBody = [
      "## J.A.R.V.I.S v3.0 (Release V3)",
      "",
      "### 1. Unified AI Engine",
      "- **OpenJarvis 5-Primitive Core**: Intelligence (`gemini-4-hydrogen` -> `gemini-3.1-flash-lite` -> `OpenJarvis Local Cognitive Engine`), Engine (`1ms` LRU Cache + `/ws` Streaming), Agentic Logic (7 specialist nodes), Tools & Memory (`./data/sessions.json` + Obsidian Second Brain), and Trace Learning (`OpenJarvisTrace`).",
      "- **Jev System-1 Fast Reflex Harness**: Deterministic `1ms-3ms` intent triage and multi-`@ref` extraction + NUS Companion Milestone Organizer.",
      "- **vercel-labs/agent-desktop Integration**: 17 semantic accessibility tree nodes (`@e1`..`@e17`) with `snapshot`, `click`, `type`, `press`, `focus`, and Local CLI Bridge.",
      "- **Voice Models**: `gemini-3.8-flash-lite-tts` Neural TTS (`Kore`, `Fenrir`, `Puck`, `Charon`, `Zephyr`) + `gemini-3.5-transcribe` STT.",
      "",
      "### 2. Visual System (Apple x OpenAI Codex PC x Hedwig Studio)",
      "- Collapsible **Hedwig Memory Sidebar** with persistent session threads.",
      "- **Concentric Spatial Studio Stage** with Unified Diff Outbox, `@ref` Inspector, NUS & Vault panel, and custom spring-animated `StudioDropdown` menus.",
      "- **Pure-Avatar Minimal Visor Pet Pill (`JevPetPill.tsx`)** with 60fps GSAP cursor tracking, poppy enlarge-and-return physics, and harmonic voice equalizer.",
    ].join("\n");

    try {
      const ghHeaders = {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Project-JARVIS-v3",
        "Content-Type": "application/json",
      };

      let ghRes = await fetch(`https://api.github.com/repos/${repo}/releases`, {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({
          tag_name: tag,
          target_commitish: "main",
          name: releaseName,
          body: releaseBody,
          draft: false,
          prerelease: false,
        }),
      });

      let data = (await ghRes.json()) as {
        id?: number;
        html_url?: string;
        message?: string;
      };

      // If release for tag v3.0.0 already exists, fetch by tag and update it
      if (!ghRes.ok && ghRes.status === 422) {
        const existingRes = await fetch(
          `https://api.github.com/repos/${repo}/releases/tags/${tag}`,
          { headers: ghHeaders }
        );
        const existing = (await existingRes.json()) as {
          id?: number;
          html_url?: string;
        };
        if (existing.id) {
          ghRes = await fetch(
            `https://api.github.com/repos/${repo}/releases/${existing.id}`,
            {
              method: "PATCH",
              headers: ghHeaders,
              body: JSON.stringify({
                tag_name: tag,
                target_commitish: "main",
                name: releaseName,
                body: releaseBody,
                draft: false,
                prerelease: false,
              }),
            }
          );
          data = (await ghRes.json()) as {
            id?: number;
            html_url?: string;
            message?: string;
          };
        }
      }

      res.json({
        ok: gitPushed || Boolean(data.html_url),
        mode: "github-pushed-and-released",
        repo,
        tag,
        commit: gitCommit,
        gitTagVerified,
        gitPushed,
        pushOutput,
        releaseUrl: data.html_url,
        message: data.html_url
          ? `Pushed to GitHub (${gitCommit}) and published Release ${tag}: ${data.html_url}`
          : `${pushOutput} | GitHub API: ${data.message || "Completed"}`,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        gitPushed,
        pushOutput,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, HOST, () => {
    console.log(
      `J.A.R.V.I.S v3.0 Codex Workspace listening at http://${HOST}:${PORT}`
    );
  });
}

startServer().catch((err) => {
  console.error("Failed to start J.A.R.V.I.S server:", err);
  process.exit(1);
});
