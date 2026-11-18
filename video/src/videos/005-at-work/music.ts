import type { MediaState } from "../../../../src/features/media/api";
import type { Copy } from "./copy";

export const LINE_MS = 2600;
export const LYRICS_START = 300;

const COVER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a3d"/><stop offset="1" stop-color="#6c4cff"/></linearGradient></defs><rect width="96" height="96" rx="14" fill="url(#g)"/><circle cx="62" cy="36" r="14" fill="#fff" opacity="0.85"/><path d="M0 70 Q24 52 48 66 T96 60 V96 H0Z" fill="#1b1e3a" opacity="0.7"/></svg>',
)}`;

const stamp = (ms: number) => {
  const minutes = Math.floor(ms / 60_000);
  const seconds = (ms % 60_000) / 1000;
  return `${String(minutes).padStart(2, "0")}:${seconds.toFixed(2).padStart(5, "0")}`;
};

function words(line: string): string[] {
  return line.includes(" ") ? line.split(" ").map((word, index, all) => (index < all.length - 1 ? `${word} ` : word)) : [...line];
}

export function wordTimes(copy: Copy): number[] {
  return copy.lyrics.flatMap((line, row) => {
    const parts = words(line);
    const step = (LINE_MS - 500) / parts.length;
    return parts.map((_, index) => LYRICS_START + row * LINE_MS + Math.round(index * step));
  });
}

export function lrc(copy: Copy) {
  return copy.lyrics.map((line, row) => {
    const start = LYRICS_START + row * LINE_MS;
    const parts = words(line);
    const step = (LINE_MS - 500) / parts.length;
    return `[${stamp(start)}]${parts.map((word, index) => `<${stamp(start + Math.round(index * step))}>${word}`).join("")}`;
  }).join("\n");
}

export function playingMedia(copy: Copy, positionMs: number): MediaState {
  return {
    available: true, audioActive: true, audioPeak: 0.5, playbackStatus: "playing",
    title: copy.song.title, artist: copy.song.artist, album: copy.song.album, thumbnail: COVER,
    positionMs, durationMs: 198_000, positionEstimate: "timed",
    canSeek: true, canNext: true, canPrevious: true, shuffleActive: false, canShuffle: true,
    repeatMode: "none", canRepeat: true, volume: 0.6, sourceApp: null, activeSessionId: "demo",
    sessions: [{ id: "demo", label: copy.song.player, playing: true }], updatedAt: Date.now(),
  };
}
