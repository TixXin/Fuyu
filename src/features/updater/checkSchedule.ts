import type { UpdatePreferences } from "./storage";

export type ScheduleState = Pick<UpdatePreferences, "autoCheck" | "checkIntervalHours" | "lastCheckedAt"> & {
  stage: string;
  startedAt: number;
  lastAttemptAt: number | null;
  checkFailures: number;
};

export const STARTUP_DELAY_MS = 20_000;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000];

/** Both windows derive the same deadline from the native runtime's clock/state. */
export function nextUpdateCheckAt(state: ScheduleState, now = Date.now()): number | null {
  if (!state.autoCheck || !state.startedAt || ["disabled", "checking", "downloading", "installing", "done"].includes(state.stage)) return null;
  const interval = state.checkIntervalHours * 60 * 60 * 1000;
  if (state.checkFailures > 0 && state.lastAttemptAt !== null) {
    const retryDelay = RETRY_DELAYS_MS[state.checkFailures - 1] ?? interval;
    return state.lastAttemptAt > now ? now : state.lastAttemptAt + Math.min(retryDelay, interval);
  }
  // A timestamp from before a clock correction must not postpone checks indefinitely.
  const lastSuccess = state.lastCheckedAt !== null && state.lastCheckedAt <= now ? state.lastCheckedAt : null;
  const startup = state.startedAt > now ? now : state.startedAt + STARTUP_DELAY_MS;
  return Math.max(startup, lastSuccess === null ? 0 : lastSuccess + interval);
}
