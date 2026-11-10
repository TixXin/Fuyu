import { useEffect, useMemo, useState } from "react";
import type { MediaState } from "../api";
import { karaokeWords, longestLyric, lyricAt, playbackPosition, type LyricLine, type LyricWord } from "./lrc";
import type { KaraokeLook } from "./lyricsSettings";

export type CurrentLyric = {
  /** The line being sung, or null when nothing is: paused, before the first line, in a break. */
  text: string | null;
  /** Changes with each line, so the bar can fade the next one in. */
  index: number;
  /** The song's longest line, for sizing the island once per song. */
  longest: string;
  /** Not a sung line: the song's name, shown while it has no lyrics (songLine.ts). */
  song?: boolean;
  /** The line lit word by word (C30): its words, where playback was when it was read, and the look. */
  karaoke?: KaraokeLine;
};

export type KaraokeLine = {
  words: LyricWord[];
  positionMs: number;
  /** Changes when the player reports a new position or the offset changes: the fill restarts from it. */
  clock: string;
  look: KaraokeLook;
};

/** Karaoke for the bar: off (null), or with whether lines without word times fill evenly, and the look. */
export type KaraokeOptions = { even: boolean; look: KaraokeLook } | null;

const NONE: CurrentLyric = { text: null, index: -1, longest: "" };
// How long the last line stays when the island times the song itself.
const LAST_LINE_MS = 12_000;

/**
 * The line sung now, for the collapsed island. Rather than ticking, it wakes when the next line
 * starts, so the island renders once per line. Paused, or with `active` false, there is none.
 */
export function useCurrentLyric(lines: LyricLine[] | null, mediaState: MediaState, offsetMs: number, active: boolean, karaoke: KaraokeOptions = null): CurrentLyric {
  const [now, setNow] = useState(() => Date.now());
  const on = active && mediaState.playbackStatus === "playing" && lines !== null && lines.length > 0;
  const position = playbackPosition(mediaState, now) - offsetMs;
  const found = on && lines ? lyricAt(lines, position) : null;
  // The island times a player that reports no position (trackClock.ts) and cannot see it start
  // the same song again (repeat one): well past the last line, the bar stops showing it.
  const lastAt = lines && lines.length > 0 ? lines[lines.length - 1].timeMs : 0;
  const timedByIsland = mediaState.positionEstimate !== undefined;
  const ended = found !== null && timedByIsland && found.nextAt === null && position >= lastAt + LAST_LINE_MS;
  const at = ended ? null : found;
  const nextAt = found && timedByIsland && found.nextAt === null && !ended ? lastAt + LAST_LINE_MS : found?.nextAt ?? null;

  // A new report from the player (seek, pause, next track) restarts the clock from it.
  useEffect(() => {
    setNow(Date.now());
  }, [mediaState.updatedAt, offsetMs, on]);

  useEffect(() => {
    if (!on || nextAt === null) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(20, nextAt - position + 20));
    return () => window.clearTimeout(timer);
  }, [on, nextAt, position]);

  const longest = useMemo(() => (lines ? longestLyric(lines) : ""), [lines]);
  if (!at || !lines) return NONE;
  const words = karaoke && at.index >= 0 && at.text ? karaokeWords(lines[at.index], at.nextAt, karaoke.even) : undefined;
  return {
    text: at.text,
    index: at.index,
    longest,
    ...(words && { karaoke: { words, positionMs: position, clock: `${mediaState.updatedAt}:${offsetMs}`, look: karaoke!.look } }),
  };
}
