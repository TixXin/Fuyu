import type { IslandPlaybackContribution } from "../../plugin-kernel/islandContributions.ts";

const STEP_MS = 500;

export function playbackContribution(state: { playbackStatus: string; positionMs: number; durationMs: number; updatedAt: number }): IslandPlaybackContribution | null {
  if (state.playbackStatus !== "playing" || !(state.durationMs > 0) || !Number.isFinite(state.updatedAt)) return null;
  const startedAt = Math.round((state.updatedAt - Math.max(0, state.positionMs)) / STEP_MS) * STEP_MS;
  return { kind: "playback", startedAt, durationMs: Math.round(state.durationMs) };
}
