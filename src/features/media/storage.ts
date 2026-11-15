import { parseMusicSourcePriority, type KnownMediaSource } from "./sourcePriority.ts";

export type { KnownMediaSource };

export const MUSIC_SOURCE_PRIORITY_STORAGE_KEY = "fuyu-music-sources";

export function loadMusicSourcePriority(): KnownMediaSource[] {
  try {
    const stored = window.localStorage.getItem(
      MUSIC_SOURCE_PRIORITY_STORAGE_KEY,
    );

    if (!stored) {
      return [];
    }

    return parseMusicSourcePriority(JSON.parse(stored), Date.now());
  } catch {
    return [];
  }
}

export function saveMusicSourcePriority(priority: KnownMediaSource[]) {
  try {
    window.localStorage.setItem(
      MUSIC_SOURCE_PRIORITY_STORAGE_KEY,
      JSON.stringify(priority),
    );
  } catch {
  }
}
