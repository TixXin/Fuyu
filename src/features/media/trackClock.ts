export type TrackClock = {
  key: string | null;
  elapsedMs: number;
  runningSince: number | null;
  pausedAt?: number | null;
  fromStart: boolean;
};

export const NO_CLOCK: TrackClock = { key: null, elapsedMs: 0, runningSince: null, fromStart: false };

export function hasTimeline(state: { positionMs: number; durationMs: number }) {
  return state.durationMs > 0 || state.positionMs > 0;
}

export function advanceClock(clock: TrackClock, key: string, playing: boolean, now: number): TrackClock {
  if (clock.key !== key) return { key, elapsedMs: 0, runningSince: playing ? now : null, fromStart: clock.key !== null };
  if (playing && clock.runningSince === null) return { ...clock, runningSince: now };
  if (!playing && clock.runningSince !== null) {
    return { ...clock, elapsedMs: clock.elapsedMs + Math.max(0, now - clock.runningSince), runningSince: null, pausedAt: now };
  }
  return clock;
}

const EVENT_SLACK_MS = 2000;

export function settleClockAt(clock: TrackClock, key: string, playing: boolean, at: number, now: number): TrackClock {
  const when = Math.min(at, now);
  if (clock.key !== key) return advanceClock(clock, key, playing, when);
  if (playing && clock.runningSince !== null && clock.runningSince > when && clock.runningSince - when <= EVENT_SLACK_MS) {
    return { ...clock, runningSince: when };
  }
  const pausedAt = clock.pausedAt ?? null;
  if (!playing && clock.runningSince === null && pausedAt !== null && pausedAt > when && pausedAt - when <= EVENT_SLACK_MS) {
    return { ...clock, elapsedMs: Math.max(0, clock.elapsedMs - (pausedAt - when)), pausedAt: when };
  }
  return advanceClock(clock, key, playing, when);
}

type Timeline = { title: string | null; artist: string | null; sourceApp: string | null; positionMs: number; durationMs: number; updatedAt: number; positionEstimate?: "timed" | "unsure" };

export function keepIslandTimeline<T extends Timeline>(next: T, current: Timeline): T {
  const same = next.title === current.title && next.artist === current.artist && next.sourceApp === current.sourceApp;
  if (hasTimeline(next) || !current.positionEstimate || !same) return next;
  return { ...next, positionMs: current.positionMs, updatedAt: current.updatedAt, positionEstimate: current.positionEstimate };
}

export function alignClock(clock: TrackClock, positionMs: number, now: number): TrackClock {
  if (clock.key === null) return clock;
  return { ...clock, elapsedMs: Math.max(0, positionMs), runningSince: clock.runningSince === null ? null : now, fromStart: true };
}

export function clockPosition(clock: TrackClock, now: number) {
  return clock.elapsedMs + (clock.runningSince === null ? 0 : Math.max(0, now - clock.runningSince));
}

const START_SLACK_MS = 2000;

export function startClockAt(clock: TrackClock, key: string, playing: boolean, at: number, now: number): TrackClock {
  if (clock.key === key && clockPosition(clock, now) > now - at + START_SLACK_MS) return clock;
  const since = Math.min(at, now);
  return playing
    ? { key, elapsedMs: 0, runningSince: since, fromStart: true }
    : { key, elapsedMs: 0, runningSince: null, fromStart: true };
}
