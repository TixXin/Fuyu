import type { ServiceDefinition } from "../define.mjs";

export type LyricsSourceKind = "local" | "lrclib" | "kugou" | "netease" | (string & {});

export type LyricsResult = {
  source: LyricsSourceKind;
  lrc: string;
  translation?: string | null;
};

export type LyricsQuery = {
  title: string;
  artist?: string;
  album?: string;
  durationMs?: number;
  folder?: string;
  online?: boolean;
  chinese?: boolean;
  trackId?: string | null;
};

export type LyricsSourceInfo = {
  id: string;
  label?: { zh: string; en: string } | string;
  builtin?: boolean;
  order: number;
};

export type LyricsMethods = {
  lookup(query: LyricsQuery): LyricsResult | null;
  sources(): { sources: LyricsSourceInfo[] };
};

export type LyricsEvents = {
  changed: {};
};

export const lyricsV1: ServiceDefinition<LyricsMethods, LyricsEvents, {}>;
