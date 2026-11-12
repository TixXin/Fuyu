import type { MediaState } from "../api";
import { trackKey, type LyricLine } from "./lrc";
import { useLyrics, type LyricsSettings } from "./useLyrics";
import { useSongOffset } from "./useSongOffset";

export type PlayingLyrics = {
  lines: LyricLine[] | null;
  notFound: boolean;
  songOffsetMs: number;
  setSongOffsetMs: (ms: number) => void;
  offsetMs: number;
};

const NO_SOURCES: LyricsSettings = { lyricsFolder: "", lyricsOnline: false };

export function usePlayingLyrics(mediaState: MediaState, settings: LyricsSettings & { lyricsOffsetMs: number }, enabled = true): PlayingLyrics {
  const { lines, notFound } = useLyrics(mediaState, enabled ? settings : NO_SOURCES);
  const [songOffsetMs, setSongOffsetMs] = useSongOffset(lines ? trackKey(mediaState) : null);
  return { lines, notFound, songOffsetMs, setSongOffsetMs, offsetMs: settings.lyricsOffsetMs + songOffsetMs };
}
