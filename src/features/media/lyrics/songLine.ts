import type { CurrentLyric } from "./useCurrentLyric";
import type { LyricsIntro } from "./lyricsSettings";

type Track = { title: string | null; artist: string | null; playbackStatus: string };

const INTRO_INDEX = -3;

function titleLine(track: Track): string | null {
  const title = track.title?.trim();
  if (!title) return null;
  const artist = track.artist?.trim();
  return artist ? `${title} - ${artist}` : title;
}

export function songLine(track: Track, notFound: boolean): CurrentLyric | null {
  const text = titleLine(track);
  if (!notFound || !text || track.playbackStatus !== "playing") return null;
  return { text, index: -2, longest: text, song: true };
}

export function introLine(track: Track, intro: LyricsIntro, longest: string): CurrentLyric | null {
  if (intro === "todo" || track.playbackStatus !== "playing") return null;
  const text = intro === "note" ? "♪" : titleLine(track);
  if (!text) return null;
  return { text, index: INTRO_INDEX, longest: longest.length > text.length ? longest : text, song: intro === "song" };
}
