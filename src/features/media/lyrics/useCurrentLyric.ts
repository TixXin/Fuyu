import { useEffect, useMemo, useState } from "react";
import type { MediaState } from "../api";
import { karaokeWords, longestLyric, lyricAt, playbackPosition, type LyricLine, type LyricWord } from "./lrc";
import type { KaraokeLook } from "./lyricsSettings";

export type CurrentLyric = {
  text: string | null;
  index: number;
  longest: string;
  song?: boolean;
  karaoke?: KaraokeLine;
};

export type KaraokeLine = {
  words: LyricWord[];
  positionMs: number;
  clock: string;
  look: KaraokeLook;
};

export type KaraokeOptions = { even: boolean; look: KaraokeLook } | null;

const NONE: CurrentLyric = { text: null, index: -1, longest: "" };
const LAST_LINE_MS = 12_000;

export function useCurrentLyric(lines: LyricLine[] | null, mediaState: MediaState, offsetMs: number, active: boolean, karaoke: KaraokeOptions = null): CurrentLyric {
  const [now, setNow] = useState(() => Date.now());
  const on = active && mediaState.playbackStatus === "playing" && lines !== null && lines.length > 0;
  const position = playbackPosition(mediaState, now) - offsetMs;
  const found = on && lines ? lyricAt(lines, position) : null;
  const lastAt = lines && lines.length > 0 ? lines[lines.length - 1].timeMs : 0;
  const timedByIsland = mediaState.positionEstimate !== undefined;
  const ended = found !== null && timedByIsland && found.nextAt === null && position >= lastAt + LAST_LINE_MS;
  const at = ended ? null : found;
  const nextAt = found && timedByIsland && found.nextAt === null && !ended ? lastAt + LAST_LINE_MS : found?.nextAt ?? null;

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
