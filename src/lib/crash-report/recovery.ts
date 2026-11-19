export const CRASH_RELOAD_WINDOW_MS = 60_000;

export type CrashStep = "reload" | "fallback";

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

export type CrashVariant = "island" | "window" | "silent";

export function crashVariant(windowKind: string | null): CrashVariant {
  if (windowKind === null) return "island";
  return windowKind === "drag-grid" ? "silent" : "window";
}
