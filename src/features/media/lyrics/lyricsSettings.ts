import { clamp } from "../../../utils/number.ts";
import { getColorSetting } from "../../../utils/color.ts";

export type LyricsSettingValues = {
  lyricsFolder: string;
  lyricsOnline: boolean;
  lyricsChinese: boolean;
  lyricsOffsetMs: number;
  lyricsOnIsland: boolean;
  lyricsIslandPriority: LyricsIslandPriority;
  lyricsIntro: LyricsIntro;
  lyricsKaraoke: boolean;
  lyricsKaraokeFallback: LyricsKaraokeFallback;
  lyricsKaraokeFill: LyricsKaraokeFill;
  lyricsKaraokeColor: LyricsKaraokeColor;
  lyricsKaraokeCustomColor: string;
  lyricsKaraokeDim: number;
  lyricsKaraokeGlow: boolean;
  lyricsKaraokeFollow: boolean;
  lyricsCoverColor: boolean;
};

export type LyricsKaraokeFallback = "line" | "none";
export type LyricsKaraokeFill = "smooth" | "word";
export type LyricsKaraokeColor = "ink" | "accent" | "custom";
export const LYRICS_KARAOKE_DIM = { min: 15, max: 80, default: 45 } as const;

export type LyricsIslandPriority = "lyrics" | "agent";
export type LyricsIntro = "todo" | "song" | "note";

export function chineseLyricsByDefault(languages: readonly (string | undefined)[]): boolean {
  return languages.some((language) => typeof language === "string" && /^zh(-|_|$)/i.test(language));
}

function systemLanguages(): (string | undefined)[] {
  const navigator = (globalThis as { navigator?: { language?: string; languages?: readonly string[] } }).navigator;
  return [navigator?.language, ...(navigator?.languages ?? [])];
}

export const DEFAULT_LYRICS_SETTINGS: LyricsSettingValues = {
  lyricsFolder: "",
  lyricsOnline: true,
  lyricsChinese: chineseLyricsByDefault(systemLanguages()),
  lyricsOffsetMs: 0,
  lyricsOnIsland: true,
  lyricsIslandPriority: "lyrics",
  lyricsIntro: "todo",
  lyricsKaraoke: true,
  lyricsKaraokeFallback: "line",
  lyricsKaraokeFill: "smooth",
  lyricsKaraokeColor: "ink",
  lyricsKaraokeCustomColor: "#ff8fab",
  lyricsKaraokeDim: LYRICS_KARAOKE_DIM.default,
  lyricsKaraokeGlow: false,
  lyricsKaraokeFollow: true,
  lyricsCoverColor: false,
};

export function normalizeLyricsSettings(saved: Partial<Record<keyof LyricsSettingValues, unknown>> | null | undefined): LyricsSettingValues {
  const offset = saved?.lyricsOffsetMs;
  return {
    lyricsFolder: typeof saved?.lyricsFolder === "string" ? saved.lyricsFolder.trim() : "",
    lyricsOnline: saved?.lyricsOnline === true,
    lyricsChinese: typeof saved?.lyricsChinese === "boolean" ? saved.lyricsChinese : DEFAULT_LYRICS_SETTINGS.lyricsChinese,
    lyricsOnIsland: saved?.lyricsOnIsland === true,
    lyricsIslandPriority: saved?.lyricsIslandPriority === "agent" ? "agent" : "lyrics",
    lyricsIntro: saved?.lyricsIntro === "song" || saved?.lyricsIntro === "note" ? saved.lyricsIntro : "todo",
    lyricsKaraoke: saved?.lyricsKaraoke !== false,
    lyricsKaraokeFallback: saved?.lyricsKaraokeFallback === "none" ? "none" : "line",
    lyricsKaraokeFill: saved?.lyricsKaraokeFill === "word" ? "word" : "smooth",
    lyricsKaraokeColor: saved?.lyricsKaraokeColor === "accent" || saved?.lyricsKaraokeColor === "custom" ? saved.lyricsKaraokeColor : "ink",
    lyricsKaraokeCustomColor: getColorSetting(saved?.lyricsKaraokeCustomColor, DEFAULT_LYRICS_SETTINGS.lyricsKaraokeCustomColor),
    lyricsKaraokeDim: typeof saved?.lyricsKaraokeDim === "number" && Number.isFinite(saved.lyricsKaraokeDim)
      ? clamp(Math.round(saved.lyricsKaraokeDim / 5) * 5, LYRICS_KARAOKE_DIM.min, LYRICS_KARAOKE_DIM.max)
      : LYRICS_KARAOKE_DIM.default,
    lyricsKaraokeGlow: saved?.lyricsKaraokeGlow === true,
    lyricsKaraokeFollow: saved?.lyricsKaraokeFollow !== false,
    lyricsCoverColor: saved?.lyricsCoverColor === true,
    lyricsOffsetMs: typeof offset === "number" && Number.isFinite(offset) ? Math.round(Math.min(3000, Math.max(-3000, offset)) / 100) * 100 : 0,
  };
}

export type KaraokeLook = { fill: LyricsKaraokeFill; lit: string; dim: string; glow: boolean; follow: boolean };

export function karaokeLook(settings: LyricsSettingValues, ink = "var(--task-text-color, #fff)"): KaraokeLook {
  const chosen = settings.lyricsKaraokeColor === "accent" ? "var(--color-accent, #74d6ff)" : settings.lyricsKaraokeColor === "custom" ? settings.lyricsKaraokeCustomColor : ink;
  const lit = settings.lyricsCoverColor ? `var(--cover-accent, ${chosen})` : chosen;
  return {
    fill: settings.lyricsKaraokeFill,
    lit,
    dim: `color-mix(in srgb, ${ink} ${settings.lyricsKaraokeDim}%, transparent)`,
    glow: settings.lyricsKaraokeGlow,
    follow: settings.lyricsKaraokeFollow,
  };
}
