import type { CurrentLyric } from "./useCurrentLyric";

export function songLine(
  track: { title: string | null; artist: string | null; playbackStatus: string },
  notFound: boolean,
): CurrentLyric | null {
  const title = track.title?.trim();
  if (!notFound || !title || track.playbackStatus !== "playing") return null;
  const artist = track.artist?.trim();
  const text = artist ? `${title} - ${artist}` : title;
  return { text, index: -2, longest: text, song: true };
}
