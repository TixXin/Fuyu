import { readJson, writeJson } from "../../../lib/storage.ts";

export const SONG_OFFSETS_STORAGE_KEY = "fuyu-lyrics-offsets";
export const MAX_SONG_OFFSETS = 500;
export const SONG_OFFSET_STEP_MS = 500;
const LIMIT_MS = 10_000;

export type SongOffsets = Record<string, number>;

export function clampSongOffset(ms: number) {
  return Math.max(-LIMIT_MS, Math.min(LIMIT_MS, Math.round(ms / 100) * 100));
}

export function setSongOffset(offsets: SongOffsets, key: string, ms: number): SongOffsets {
  const entries = Object.entries(offsets).filter(([other]) => other !== key);
  const value = clampSongOffset(ms);
  if (value !== 0) entries.push([key, value]);
  return Object.fromEntries(entries.slice(-MAX_SONG_OFFSETS));
}

export function normalizeSongOffsets(value: unknown): SongOffsets {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]) && entry[1] !== 0)
    .map(([key, ms]) => [key, clampSongOffset(ms)] as const);
  return Object.fromEntries(entries.slice(-MAX_SONG_OFFSETS));
}

export function loadSongOffsets(): SongOffsets {
  return normalizeSongOffsets(readJson(SONG_OFFSETS_STORAGE_KEY));
}

export function saveSongOffsets(offsets: SongOffsets) {
  writeJson(SONG_OFFSETS_STORAGE_KEY, offsets);
}
