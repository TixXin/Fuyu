import type { RecordingState } from "./api";

export function elapsedOf(state: RecordingState | null, now: number): number {
  if (!state || state.phase !== "recording") return 0;
  return state.paused ? state.elapsedMs : state.elapsedMs + Math.max(0, now - state.sinceMs);
}

export function clockTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${String(minutes).padStart(2, "0")}:${seconds}`;
}
