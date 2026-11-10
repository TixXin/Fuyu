/**
 * A stand-in for the playback position when the player reports none. NetEase Cloud Music, for
 * one, gives Windows' media session a title and artist but leaves the position and length at 0
 * (its own "SMTC" switch included; its InfLink plugin reports them), so the island times the
 * track itself: from when it first saw the track, counting only while it plays. It cannot know
 * about seeking in the player, or how far a track had played before the island first saw it;
 * the user can align it to a lyric line (alignClock).
 */
export type TrackClock = {
  /** The track being timed, or null when nothing is. */
  key: string | null;
  /** Playing time counted up to `runningSince` (or up to the last pause). */
  elapsedMs: number;
  /** When the current stretch of playing began; null while paused. */
  runningSince: number | null;
  /** When it last stopped; null while playing or before the first pause. */
  pausedAt?: number | null;
  /**
   * Whether the count can be trusted: the island saw the track start (it changed from another
   * timed track), or the user aligned it. The first track the island sees may be half played.
   */
  fromStart: boolean;
};

export const NO_CLOCK: TrackClock = { key: null, elapsedMs: 0, runningSince: null, fromStart: false };

/** Whether the player reports a position at all. */
export function hasTimeline(state: { positionMs: number; durationMs: number }) {
  return state.durationMs > 0 || state.positionMs > 0;
}

/** The clock after a reading at `now`: restarted for another track, running or stopped with playback. */
export function advanceClock(clock: TrackClock, key: string, playing: boolean, now: number): TrackClock {
  if (clock.key !== key) return { key, elapsedMs: 0, runningSince: playing ? now : null, fromStart: clock.key !== null };
  if (playing && clock.runningSince === null) return { ...clock, runningSince: now };
  if (!playing && clock.runningSince !== null) {
    return { ...clock, elapsedMs: clock.elapsedMs + Math.max(0, now - clock.runningSince), runningSince: null, pausedAt: now };
  }
  return clock;
}

// How long after a play or pause a reading may have seen it first and timed it from itself.
const EVENT_SLACK_MS = 2000;

/**
 * The clock after the player said it played or paused at `at`. A poll that was under way then
 * may have seen the change first and timed it from its own reading, a little late; that start or
 * stop moves back to `at`, so the lyrics do not slip by the poll's delay at every pause.
 */
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

/**
 * A state a play / pause / skip command answered with, keeping the island's own timing of the
 * same track: the player reports no position, and taking its 0 put the lyrics back at the start
 * until the next reading.
 */
export function keepIslandTimeline<T extends Timeline>(next: T, current: Timeline): T {
  const same = next.title === current.title && next.artist === current.artist && next.sourceApp === current.sourceApp;
  if (hasTimeline(next) || !current.positionEstimate || !same) return next;
  return { ...next, positionMs: current.positionMs, updatedAt: current.updatedAt, positionEstimate: current.positionEstimate };
}

/** The clock set to `positionMs` at `now`, as when the user picks the line being sung. */
export function alignClock(clock: TrackClock, positionMs: number, now: number): TrackClock {
  if (clock.key === null) return clock;
  return { ...clock, elapsedMs: Math.max(0, positionMs), runningSince: clock.runningSince === null ? null : now, fromStart: true };
}

/** The estimated position at `now`. */
export function clockPosition(clock: TrackClock, now: number) {
  return clock.elapsedMs + (clock.runningSince === null ? 0 : Math.max(0, now - clock.runningSince));
}

// How far the clock may already be past what a start at `at` explains (polls and events race).
const START_SLACK_MS = 2000;

/**
 * The clock for `key` started at `at`, when the player says its sound began then. A clock that
 * is already further along than that (the song was playing before) is left as it is.
 */
export function startClockAt(clock: TrackClock, key: string, playing: boolean, at: number, now: number): TrackClock {
  if (clock.key === key && clockPosition(clock, now) > now - at + START_SLACK_MS) return clock;
  const since = Math.min(at, now);
  return playing
    ? { key, elapsedMs: 0, runningSince: since, fromStart: true }
    : { key, elapsedMs: 0, runningSince: null, fromStart: true };
}
