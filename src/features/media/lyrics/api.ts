import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";

export function openLyricsLink(url: string) {
  return openUrl(url);
}

export type Lyrics = {
  source: "local" | "lrclib" | "kugou" | "kugou-local" | "netease" | "qq" | "apple-music";
  lrc: string;
  translation?: string | null;
};

export type LyricsQuery = {
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  folder: string;
  online: boolean;
  chinese: boolean;
  trackId: string | null;
  sourceApp: string | null;
  appleMusic: boolean;
};

export function getLyrics(query: LyricsQuery) {
  return invoke<Lyrics | null>("get_lyrics", { query });
}

export type InflinkState = {
  betterNcm: string | null;
  installed: string | null;
  latest: string | null;
};

export function getInflinkState(checkLatest: boolean) {
  return invoke<InflinkState>("get_inflink_state", { checkLatest });
}

export function installInflink() {
  return invoke<InflinkState>("install_inflink");
}

export const APPLE_MUSIC_TOKEN_EVENT = "apple-music-token-changed";

export function hasAppleMusicToken() {
  return invoke<boolean>("has_apple_music_token");
}

export function saveAppleMusicToken(token: string) {
  return invoke<void>("save_apple_music_token", { token });
}

export function deleteAppleMusicToken() {
  return invoke<void>("delete_apple_music_token");
}

export function onAppleMusicTokenChanged(handler: (saved: boolean) => void) {
  return listen<{ saved: boolean }>(APPLE_MUSIC_TOKEN_EVENT, (event) => handler(event.payload.saved));
}
