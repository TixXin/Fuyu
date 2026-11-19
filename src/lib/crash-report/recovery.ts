export const CRASH_RELOAD_WINDOW_MS = 60_000;

export const RETRY_MEMORY_MS = 600_000;

export type CrashStep = "reload" | "fallback";
export type CrashOutcome = { step: CrashStep; retried: boolean };

export function parseReloadAt(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function nextCrashStep(state: { now: number; lastReloadAt: number | null; dev: boolean }): CrashStep {
  if (state.dev) return "fallback";
  if (state.lastReloadAt === null) return "reload";
  const since = state.now - state.lastReloadAt;
  return since >= 0 && since < CRASH_RELOAD_WINDOW_MS ? "fallback" : "reload";
}

export function retryFailed(state: { now: number; lastRetryAt: number | null }): boolean {
  if (state.lastRetryAt === null) return false;
  const since = state.now - state.lastRetryAt;
  return since >= 0 && since < RETRY_MEMORY_MS;
}

export type CrashVariant = "island" | "window" | "silent";

export function crashVariant(windowKind: string | null): CrashVariant {
  if (windowKind === null) return "island";
  return windowKind === "drag-grid" ? "silent" : "window";
}
