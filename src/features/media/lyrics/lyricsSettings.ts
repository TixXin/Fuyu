import { clamp } from "../../../utils/number.ts";
import { getColorSetting } from "../../../utils/color.ts";

/** The lyrics settings kept with the island's settings (Settings → Music → Lyrics). */
export type LyricsSettingValues = {
  lyricsFolder: string;
  lyricsOnline: boolean;
  lyricsChinese: boolean;
  lyricsOffsetMs: number;
  lyricsOnIsland: boolean;
  lyricsIslandPriority: LyricsIslandPriority;
  /** The collapsed island's line lights up as it is sung (C30). */
  lyricsKaraoke: boolean;
  /** A line with no word times: filled evenly over the line, or shown plain. */
  lyricsKaraokeFallback: LyricsKaraokeFallback;
  /** Smooth: each word fills from left to right. Word: each word lights at once. */
  lyricsKaraokeFill: LyricsKaraokeFill;
  /** The sung part's colour: the island's text colour, the accent, or `lyricsKaraokeCustomColor`. */
  lyricsKaraokeColor: LyricsKaraokeColor;
  lyricsKaraokeCustomColor: string;
  /** How bright the part not sung yet is, in percent of the sung colour (15–80). */
  lyricsKaraokeDim: number;
  /** A soft glow around the line. */
  lyricsKaraokeGlow: boolean;
  /** A line wider than the island slides along so the word being sung stays in view. */
  lyricsKaraokeFollow: boolean;
};

export type LyricsKaraokeFallback = "line" | "none";
export type LyricsKaraokeFill = "smooth" | "word";
export type LyricsKaraokeColor = "ink" | "accent" | "custom";
export const LYRICS_KARAOKE_DIM = { min: 15, max: 80, default: 45 } as const;

/**
 * Who has the collapsed bar's text while a line is sung and an agent is named: the lyrics, with
 * an agent shown for a moment when its session changes (and while it waits on the user), or the agent.
 */
export type LyricsIslandPriority = "lyrics" | "agent";

/**
 * Kugou and NetEase start on where the system speaks Chinese, as LRCLIB has few Chinese songs;
 * they are still only asked once the user turns online lyrics on. A saved choice always wins.
 */
export function chineseLyricsByDefault(languages: readonly (string | undefined)[]): boolean {
  return languages.some((language) => typeof language === "string" && /^zh(-|_|$)/i.test(language));
}

function systemLanguages(): (string | undefined)[] {
  const navigator = (globalThis as { navigator?: { language?: string; languages?: readonly string[] } }).navigator;
  return [navigator?.language, ...(navigator?.languages ?? [])];
}

/**
 * No folder, lyrics found online and shown on the collapsed island, no offset. Saved settings
 * without the online and on-island switches keep them off, as islands before them had.
 */
export const DEFAULT_LYRICS_SETTINGS: LyricsSettingValues = {
  lyricsFolder: "",
  lyricsOnline: true,
  lyricsChinese: chineseLyricsByDefault(systemLanguages()),
  lyricsOffsetMs: 0,
  lyricsOnIsland: true,
  lyricsIslandPriority: "lyrics",
  lyricsKaraoke: true,
  lyricsKaraokeFallback: "line",
  lyricsKaraokeFill: "smooth",
  lyricsKaraokeColor: "ink",
  lyricsKaraokeCustomColor: "#ff8fab",
  lyricsKaraokeDim: LYRICS_KARAOKE_DIM.default,
  lyricsKaraokeGlow: false,
  lyricsKaraokeFollow: true,
};

/** Saved lyrics settings with anything missing or malformed set back to the default. */
export function normalizeLyricsSettings(saved: Partial<Record<keyof LyricsSettingValues, unknown>> | null | undefined): LyricsSettingValues {
  const offset = saved?.lyricsOffsetMs;
  return {
    lyricsFolder: typeof saved?.lyricsFolder === "string" ? saved.lyricsFolder.trim() : "",
    lyricsOnline: saved?.lyricsOnline === true,
    lyricsChinese: typeof saved?.lyricsChinese === "boolean" ? saved.lyricsChinese : DEFAULT_LYRICS_SETTINGS.lyricsChinese,
    lyricsOnIsland: saved?.lyricsOnIsland === true,
    lyricsIslandPriority: saved?.lyricsIslandPriority === "agent" ? "agent" : "lyrics",
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
    lyricsOffsetMs: typeof offset === "number" && Number.isFinite(offset) ? Math.round(Math.min(3000, Math.max(-3000, offset)) / 100) * 100 : 0,
  };
}

/** How a karaoke line looks, as CSS: the sung colour, the unsung colour, and the switches. */
export type KaraokeLook = { fill: LyricsKaraokeFill; lit: string; dim: string; glow: boolean; follow: boolean };

/** The look the settings ask for. `ink` is the colour the bar's text has now (a CSS value). */
export function karaokeLook(settings: LyricsSettingValues, ink = "var(--task-text-color, #fff)"): KaraokeLook {
  const lit = settings.lyricsKaraokeColor === "accent" ? "var(--color-accent, #74d6ff)" : settings.lyricsKaraokeColor === "custom" ? settings.lyricsKaraokeCustomColor : ink;
  // The unsung part is the bar's own text colour, faded, so a coloured highlight reads as progress.
  return {
    fill: settings.lyricsKaraokeFill,
    lit,
    dim: `color-mix(in srgb, ${ink} ${settings.lyricsKaraokeDim}%, transparent)`,
    glow: settings.lyricsKaraokeGlow,
    follow: settings.lyricsKaraokeFollow,
  };
}
