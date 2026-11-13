/**
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
  const matchedRefs = normalized.match(/@e\d+/g) ?? [];
  return {
    route: matchedRefs.length > 0 ? "agent_desktop" : "openjarvis_system2",
    matchedRefs,
    bypassSystem2: matchedRefs.length > 0 && normalized.length < 48,
    deadlineMs: config.maxLatencyMs,
    tracedAt: Date.now(),
  };
}
