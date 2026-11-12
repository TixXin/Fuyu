import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

export function openLyricsLink(url: string) {
  return openUrl(url);
}

export type Lyrics = {
  source: "local" | "lrclib" | "kugou" | "netease";
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
