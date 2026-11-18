import type { LyricsQuery, LyricsResult, LyricsSourceInfo } from "@fuyu/plugin-services";

export type NormalizedLyricsQuery = Required<Omit<LyricsQuery, "trackId">> & {
  trackId: string | null;
};

export type LyricsSourceSpec = {
  id: string;
  label?: { zh: string; en: string } | string;
  order?: number;
  beforeBuiltin?: boolean;
  lookup: (query: NormalizedLyricsQuery) => LyricsResult | null | Promise<LyricsResult | null>;
};

export type LyricsSourceRegistry = {
  register(spec: LyricsSourceSpec): () => void;
  sources(): { sources: readonly LyricsSourceInfo[] };
  subscribe(listener: () => void): () => void;
  lookup(
    query: unknown,
    callBuiltin?: (query: NormalizedLyricsQuery) => unknown | Promise<unknown>,
  ): Promise<LyricsResult | null>;
  clear(): void;
};

export const BUILTIN_LYRICS_SOURCES: readonly LyricsSourceInfo[];
export function lyricsQueryOf(params: unknown): NormalizedLyricsQuery;
export function normalizeLyricsResult(raw: unknown, fallbackSource?: string): LyricsResult | null;
export function createLyricsSourceRegistry(options?: {
  onChange?: () => void;
}): LyricsSourceRegistry;
export function registerLyricsSource(spec: LyricsSourceSpec): () => void;
export function getLyricsSources(): { sources: readonly LyricsSourceInfo[] };
export function subscribeLyricsSources(listener: () => void): () => void;
export function lookupLyricsWithSources(
  query: unknown,
  callBuiltin?: (query: NormalizedLyricsQuery) => unknown | Promise<unknown>,
): Promise<LyricsResult | null>;
export function clearLyricsSourcesForTest(): void;
