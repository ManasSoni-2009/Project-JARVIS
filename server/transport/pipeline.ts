import {
  AgentDesktopEnvelope,
  CodexDiffPatch,
  Intent,
  JevReflexDecision,
  OpenJarvisTrace,
  PillMood,
  PipelineEvent,
  TerminalLogEntry,
  TraceStep,
} from "../brain/state.ts";
import { Supervisor, SupervisorResult } from "../brain/supervisor.ts";
import { STT } from "./stt.ts";
import { JarvisTTS } from "./tts.ts";

export interface PipelineTextResult {
  response: string;
  intent: Intent;
  agentOutput: string;
  sessionId: string;
  audioBase64: string | null;
  roundTripMs: number;
  sources?: Array<{ title: string; uri: string }>;
  jevDecision: JevReflexDecision;
  trace: OpenJarvisTrace;
  codeDiff?: CodexDiffPatch | null;
  desktopEnvelope?: AgentDesktopEnvelope | null;
}

export interface PipelineAudioResult extends PipelineTextResult {
  userText: string;
}

export class JarvisPipeline {
  private supervisor: Supervisor;
  private stt: STT;
  private tts: JarvisTTS;
  private onEvent?: (event: PipelineEvent) => Promise<void> | void;
  private onJevReflex?: (decision: JevReflexDecision) => Promise<void> | void;
  private onStep?: (step: TraceStep, mood: PillMood) => Promise<void> | void;
  private onTerminalLog?: (entry: TerminalLogEntry) => Promise<void> | void;

  constructor(opts: {
    supervisor: Supervisor;
    stt: STT;
    tts: JarvisTTS;
    onEvent?: (event: PipelineEvent) => Promise<void> | void;
    onJevReflex?: (decision: JevReflexDecision) => Promise<void> | void;
    onStep?: (step: TraceStep, mood: PillMood) => Promise<void> | void;
    onTerminalLog?: (entry: TerminalLogEntry) => Promise<void> | void;
  }) {
    this.supervisor = opts.supervisor;
    this.stt = opts.stt;
    this.tts = opts.tts;
    this.onEvent = opts.onEvent;
    this.onJevReflex = opts.onJevReflex;
    this.onStep = opts.onStep;
    this.onTerminalLog = opts.onTerminalLog;
  }

  async processText(
    text: string,
    onTextReady?: (
      partial: Omit<PipelineTextResult, "audioBase64">
    ) => Promise<void> | void,
    opts?: { sessionId?: string; skipBlockingTts?: boolean }
  ): Promise<PipelineTextResult> {
    const t0 = performance.now();
    await this.emit({
      state: "JEV_REFLEX",
      pillMood: "reflex_zap",
      data: { user_text: text },
    });

    const supResult = await this.supervisor.run(
      text,
      {
        onJevReflex: async (decision) => {
          if (this.onJevReflex) await this.onJevReflex(decision);
          await this.emit({
            state:
              decision.intent === "agent_desktop" ? "ACTING_REF" : "THINKING",
            pillMood: decision.pillMood,
            data: {
              user_text: text,
              intent: decision.intent,
              instant_ack: decision.instantAck,
              jev_latency_ms: decision.latencyMs,
            },
          });
        },
        onStep: async (step, mood) => {
          if (this.onStep) await this.onStep(step, mood);
        },
        onTerminalLog: async (entry) => {
          if (this.onTerminalLog) await this.onTerminalLog(entry);
        },
      },
      opts?.sessionId
    );

    const llmRoundTripMs = Math.max(1, Math.round(performance.now() - t0));
    const partialResult: Omit<PipelineTextResult, "audioBase64"> = {
      response: supResult.finalResponse,
      intent: supResult.intent,
      agentOutput: supResult.agentOutput,
      sessionId: supResult.sessionId,
      roundTripMs: llmRoundTripMs,
      sources: supResult.sources,
      jevDecision: supResult.jevDecision,
      trace: supResult.trace,
      codeDiff: supResult.codeDiff,
      desktopEnvelope: supResult.desktopEnvelope,
    };

    if (onTextReady) {
      await onTextReady(partialResult);
    }

    let audioBase64: string | null = null;
    if (supResult.finalResponse && !opts?.skipBlockingTts) {
      await this.emit({
        state: "SPEAKING",
        pillMood: "speaking",
        data: { response: supResult.finalResponse, intent: supResult.intent },
      });
      try {
        audioBase64 = await this.tts.synthesize(supResult.finalResponse);
      } catch {
        audioBase64 = null;
      }
    }

    const roundTripMs = Math.max(1, Math.round(performance.now() - t0));
    await this.emit({
      state: "IDLE",
      pillMood: "celebrating",
      data: {
        last_user: text,
        last_response: supResult.finalResponse,
        intent: supResult.intent,
        round_trip_ms: roundTripMs,
      },
    });

    return {
      ...partialResult,
      audioBase64,
    };
  }

  async processAudio(
    audioBuffer: Buffer,
    mimeType = "audio/webm",
    onTextReady?: (
      partial: Omit<PipelineAudioResult, "audioBase64">
    ) => Promise<void> | void,
    sessionId?: string
  ): Promise<PipelineAudioResult | null> {
    const t0 = performance.now();
    await this.emit({
      state: "TRANSCRIBING",
      pillMood: "listening",
      data: {},
    });

    const userText = await this.stt.transcribeBytes(audioBuffer, mimeType);
    if (!userText) {
      await this.emit({ state: "IDLE", pillMood: "idle", data: {} });
      return null;
    }

    await this.emit({
      state: "JEV_REFLEX",
      pillMood: "reflex_zap",
      data: { user_text: userText },
    });

    const supResult: SupervisorResult = await this.supervisor.run(
      userText,
      {
        onJevReflex: async (decision) => {
          if (this.onJevReflex) await this.onJevReflex(decision);
          await this.emit({
            state:
              decision.intent === "agent_desktop" ? "ACTING_REF" : "THINKING",
            pillMood: decision.pillMood,
            data: {
              user_text: userText,
              intent: decision.intent,
              instant_ack: decision.instantAck,
              jev_latency_ms: decision.latencyMs,
            },
          });
        },
        onStep: async (step, mood) => {
          if (this.onStep) await this.onStep(step, mood);
        },
        onTerminalLog: async (entry) => {
          if (this.onTerminalLog) await this.onTerminalLog(entry);
        },
      },
      sessionId
    );

    const llmRoundTripMs = Math.max(1, Math.round(performance.now() - t0));
    const partialResult: Omit<PipelineAudioResult, "audioBase64"> = {
      userText,
      response: supResult.finalResponse,
      intent: supResult.intent,
      agentOutput: supResult.agentOutput,
      sessionId: supResult.sessionId,
      roundTripMs: llmRoundTripMs,
      sources: supResult.sources,
      jevDecision: supResult.jevDecision,
      trace: supResult.trace,
      codeDiff: supResult.codeDiff,
      desktopEnvelope: supResult.desktopEnvelope,
    };

    if (onTextReady) {
      await onTextReady(partialResult);
    }

    let audioBase64: string | null = null;
    if (supResult.finalResponse) {
      await this.emit({
        state: "SPEAKING",
        pillMood: "speaking",
        data: { response: supResult.finalResponse, intent: supResult.intent },
      });
      try {
        audioBase64 = await this.tts.synthesize(supResult.finalResponse);
      } catch {
        audioBase64 = null;
      }
    }

    const roundTripMs = Math.max(1, Math.round(performance.now() - t0));
    await this.emit({
      state: "IDLE",
      pillMood: "celebrating",
      data: {
        last_user: userText,
        last_response: supResult.finalResponse,
        intent: supResult.intent,
        round_trip_ms: roundTripMs,
      },
    });

    return {
      ...partialResult,
      audioBase64,
    };
  }

  private async emit(event: PipelineEvent): Promise<void> {
    if (this.onEvent) {
      try {
        await this.onEvent(event);
      } catch {
        // Ignore broadcast error
      }
    }
  }
}
