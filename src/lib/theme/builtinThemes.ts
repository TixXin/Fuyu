import { activeTone, themeColors, withThemeColors, type ThemeColors, type ThemeTone } from "./themeMode.ts";
import { DEFAULT_GLASS_SETTINGS, GLASS_SETTING_KEYS, type GlassSettingValues } from "../settings/glassSettings.ts";
import { DEFAULT_SETTINGS } from "../settings/settingsDefaults.ts";
import type { AccentMode, AppearanceMode, IslandCornerShape, IslandSettings } from "../settings/types";
import type { BuiltinFontStyle } from "./fonts.ts";

export const BUILTIN_THEME_IDS = [
  "default",
  "swissChalk",
  "arcticFrost",
  "warmPaper",
  "midnightIndigo",
  "retroPixel",
  "liquidAurora",
  "monoTerminal",
  "amberVinyl",
  "sakuraCloud",
  "mossForest",
  "micaStudio",
] as const;

export type BuiltinThemeId = (typeof BUILTIN_THEME_IDS)[number];

export type BuiltinThemeGlass = GlassSettingValues & { glassIntensity: number };

export type BuiltinTheme = {
  tone: ThemeTone;
  appearanceMode: AppearanceMode;
  opacity: number;
  islandOpacity: number;
  fontFamily: BuiltinFontStyle;
  fontScale: number;
  islandCornerShape: IslandCornerShape;
  islandCornerRadius: number;
  topFilletRadius: number;
  accentMode: AccentMode;
  accentColor: string;
  pulseBrightness: number;
  glass?: BuiltinThemeGlass;
} & Record<ThemeTone, ThemeColors>;

const STYLE_KEYS = [
  "appearanceMode",
  "opacity",
  "islandOpacity",
  "fontFamily",
  "fontScale",
  "islandCornerShape",
  "islandCornerRadius",
  "topFilletRadius",
  "accentMode",
  "pulseBrightness",
] as const;

function glassSet(overrides: Partial<BuiltinThemeGlass>): BuiltinThemeGlass {
  return { ...DEFAULT_GLASS_SETTINGS, glassIntensity: DEFAULT_SETTINGS.glassIntensity, ...overrides };
}

export const BUILTIN_THEMES: Record<BuiltinThemeId, BuiltinTheme> = {
  default: {
    tone: DEFAULT_SETTINGS.themeMode === "light" ? "light" : "dark",
    appearanceMode: DEFAULT_SETTINGS.appearanceMode,
    opacity: DEFAULT_SETTINGS.opacity,
    islandOpacity: DEFAULT_SETTINGS.islandOpacity,
    fontFamily: DEFAULT_SETTINGS.fontFamily as BuiltinFontStyle,
    fontScale: DEFAULT_SETTINGS.fontScale,
    islandCornerShape: DEFAULT_SETTINGS.islandCornerShape,
    islandCornerRadius: DEFAULT_SETTINGS.islandCornerRadius,
    topFilletRadius: DEFAULT_SETTINGS.topFilletRadius,
    accentMode: DEFAULT_SETTINGS.accentMode,
    accentColor: DEFAULT_SETTINGS.accentColor,
    pulseBrightness: DEFAULT_SETTINGS.pulseBrightness,
    light: themeColors(DEFAULT_SETTINGS, "light"),
    dark: themeColors(DEFAULT_SETTINGS, "dark"),
  },
  swissChalk: {
    tone: "light",
    appearanceMode: "classic",
    opacity: 96,
    islandOpacity: 100,
    fontFamily: "system",
    fontScale: 98,
    islandCornerShape: "squircle",
    islandCornerRadius: 18,
    topFilletRadius: 4,
    accentMode: "pick",
    accentColor: "#e05a33",
    pulseBrightness: 110,
    dark: { islandBackgroundColor: "#1d1f24", taskTextColor: "#f2f3f6", pulseColor: "#ff6b3d", inkColor: "#eceef2" },
    light: { islandBackgroundColor: "#e6e8ec", taskTextColor: "#18191d", pulseColor: "#c8431b", inkColor: "#18191d" },
  },
  arcticFrost: {
    tone: "light",
    appearanceMode: "liquidGlass",
    opacity: 86,
    islandOpacity: 100,
    fontFamily: "system",
    fontScale: 100,
    islandCornerShape: "squircle",
    islandCornerRadius: 26,
    topFilletRadius: 10,
    accentMode: "pick",
    accentColor: "#0c87cc",
    pulseBrightness: 115,
    dark: { islandBackgroundColor: "#0d1622", taskTextColor: "#f4f8ff", pulseColor: "#5cd6ff", inkColor: "#f0f6ff" },
    light: { islandBackgroundColor: "#f4f8fd", taskTextColor: "#101826", pulseColor: "#03649e", inkColor: "#101826" },
    glass: glassSet({
      glassStyle: "static", glassColorSource: "accent", glassColorStrength: 22, glassFlowSpeed: 0,
      glassBlobScale: 100, glassFlowWhen: "expanded", glassRim: true, glassRimWidth: 1, glassSheen: false,
      glassSpecular: true, glassMorph: "smooth", glassContrastGuard: true, glassBackdrop: "wallpaper",
      glassBlur: 22, glassSaturation: 185, glassNoise: 2, glassIntensity: 79,
    }),
  },
  warmPaper: {
    tone: "light",
    appearanceMode: "classic",
    opacity: 92,
    islandOpacity: 100,
    fontFamily: "serif",
    fontScale: 103,
    islandCornerShape: "squircle",
    islandCornerRadius: 20,
    topFilletRadius: 6,
    accentMode: "pick",
    accentColor: "#c96730",
    pulseBrightness: 100,
    dark: { islandBackgroundColor: "#1e1915", taskTextColor: "#f7efe1", pulseColor: "#f29f58", inkColor: "#f5ecdc" },
    light: { islandBackgroundColor: "#f6efe2", taskTextColor: "#2a2118", pulseColor: "#b84f1d", inkColor: "#2a2118" },
  },
  midnightIndigo: {
    tone: "dark",
    appearanceMode: "classic",
    opacity: 96,
    islandOpacity: 100,
    fontFamily: "rounded",
    fontScale: 100,
    islandCornerShape: "squircle",
    islandCornerRadius: 30,
    topFilletRadius: 12,
    accentMode: "pick",
    accentColor: "#2e7ee8",
    pulseBrightness: 115,
    dark: { islandBackgroundColor: "#0d182e", taskTextColor: "#e6efff", pulseColor: "#5eb4ff", inkColor: "#dde9ff" },
    light: { islandBackgroundColor: "#eaf1fc", taskTextColor: "#11203b", pulseColor: "#1d6ce0", inkColor: "#11203b" },
  },
  retroPixel: {
    tone: "dark",
    appearanceMode: "classic",
    opacity: 100,
    islandOpacity: 100,
    fontFamily: "pixel",
    fontScale: 100,
    islandCornerShape: "round",
    islandCornerRadius: 16,
    topFilletRadius: 2,
    accentMode: "pick",
    accentColor: "#1d9440",
    pulseBrightness: 125,
    dark: { islandBackgroundColor: "#0c130f", taskTextColor: "#ebffe8", pulseColor: "#6cff6b", inkColor: "#dcfcd7" },
    light: { islandBackgroundColor: "#e8edd6", taskTextColor: "#172315", pulseColor: "#1d8532", inkColor: "#172315" },
  },
  liquidAurora: {
    tone: "dark",
    appearanceMode: "liquidGlass",
    opacity: 84,
    islandOpacity: 100,
    fontFamily: "rounded",
    fontScale: 100,
    islandCornerShape: "squircle",
    islandCornerRadius: 32,
    topFilletRadius: 12,
    accentMode: "pick",
    accentColor: "#178ed4",
    pulseBrightness: 130,
    dark: { islandBackgroundColor: "#0a1320", taskTextColor: "#f5f9ff", pulseColor: "#6ce5ff", inkColor: "#f1f7ff" },
    light: { islandBackgroundColor: "#f0f6fc", taskTextColor: "#101b2d", pulseColor: "#0263a1", inkColor: "#101b2d" },
    glass: glassSet({
      glassStyle: "aurora", glassColorSource: "custom", glassColor1: "#5bc8ff", glassColor2: "#9d7bff", glassColor3: "#3be8b0",
      glassColorStrength: 58, glassFlowSpeed: 100, glassBlobScale: 115, glassFlowWhen: "always", glassRim: true,
      glassRimWidth: 1.5, glassSheen: true, glassSpecular: true, glassMorph: "liquid", glassContrastGuard: true,
      glassBackdrop: "native", glassBlur: 28, glassSaturation: 205, glassNoise: 3, glassIntensity: 79,
    }),
  },
  monoTerminal: {
    tone: "dark",
    appearanceMode: "classic",
    opacity: 96,
    islandOpacity: 100,
    fontFamily: "mono",
    fontScale: 96,
    islandCornerShape: "round",
    islandCornerRadius: 16,
    topFilletRadius: 0,
    accentMode: "pick",
    accentColor: "#4d7df2",
    pulseBrightness: 110,
    dark: { islandBackgroundColor: "#121520", taskTextColor: "#dce5f7", pulseColor: "#7aa2f7", inkColor: "#d8e1f2" },
    light: { islandBackgroundColor: "#edf1f7", taskTextColor: "#182030", pulseColor: "#2b5cd9", inkColor: "#182030" },
  },
  amberVinyl: {
    tone: "dark",
    appearanceMode: "liquidGlass",
    opacity: 88,
    islandOpacity: 100,
    fontFamily: "serif",
    fontScale: 100,
    islandCornerShape: "squircle",
    islandCornerRadius: 22,
    topFilletRadius: 6,
    accentMode: "pick",
    accentColor: "#ba6d10",
    pulseBrightness: 120,
    dark: { islandBackgroundColor: "#15100d", taskTextColor: "#f9efe0", pulseColor: "#f5b041", inkColor: "#f7ecda" },
    light: { islandBackgroundColor: "#f7efe1", taskTextColor: "#21170f", pulseColor: "#944f06", inkColor: "#21170f" },
    glass: glassSet({
      glassStyle: "static", glassColorSource: "cover", glassColorStrength: 36, glassFlowSpeed: 0,
      glassBlobScale: 100, glassFlowWhen: "expanded", glassRim: false, glassRimWidth: 1.5, glassSheen: true,
      glassSpecular: true, glassMorph: "smooth", glassContrastGuard: true, glassBackdrop: "wallpaper",
      glassBlur: 38, glassSaturation: 145, glassNoise: 6, glassIntensity: 80,
    }),
  },
  sakuraCloud: {
    tone: "light",
    appearanceMode: "liquidGlass",
    opacity: 88,
    islandOpacity: 100,
    fontFamily: "rounded",
    fontScale: 102,
    islandCornerShape: "squircle",
    islandCornerRadius: 34,
    topFilletRadius: 12,
    accentMode: "pick",
    accentColor: "#db4682",
    pulseBrightness: 110,
    dark: { islandBackgroundColor: "#21131b", taskTextColor: "#fcecf2", pulseColor: "#ff7eb6", inkColor: "#fae9f0" },
    light: { islandBackgroundColor: "#fcf0f5", taskTextColor: "#2a1520", pulseColor: "#c22764", inkColor: "#2a1520" },
    glass: glassSet({
      glassStyle: "flow", glassColorSource: "custom", glassColor1: "#f472b6", glassColor2: "#fb923c", glassColor3: "#c084fc",
      glassColorStrength: 28, glassFlowSpeed: 65, glassBlobScale: 110, glassFlowWhen: "expanded", glassRim: true,
      glassRimWidth: 1, glassSheen: false, glassSpecular: true, glassMorph: "soft", glassContrastGuard: true,
      glassBackdrop: "wallpaper", glassBlur: 34, glassSaturation: 170, glassNoise: 2, glassIntensity: 80,
    }),
  },
  mossForest: {
    tone: "dark",
    appearanceMode: "classic",
    opacity: 95,
    islandOpacity: 100,
    fontFamily: "system",
    fontScale: 100,
    islandCornerShape: "squircle",
    islandCornerRadius: 26,
    topFilletRadius: 10,
    accentMode: "pick",
    accentColor: "#289c66",
    pulseBrightness: 105,
    dark: { islandBackgroundColor: "#0f1c16", taskTextColor: "#e7f3ec", pulseColor: "#57d996", inkColor: "#e2efe8" },
    light: { islandBackgroundColor: "#ecf4ee", taskTextColor: "#14241b", pulseColor: "#1c8550", inkColor: "#14241b" },
  },
  micaStudio: {
    tone: "light",
    appearanceMode: "liquidGlass",
    opacity: 86,
    islandOpacity: 100,
    fontFamily: "system",
    fontScale: 100,
    islandCornerShape: "squircle",
    islandCornerRadius: 24,
    topFilletRadius: 8,
    accentMode: "pick",
    accentColor: "#397de0",
    pulseBrightness: 100,
    dark: { islandBackgroundColor: "#14181e", taskTextColor: "#f0f4fa", pulseColor: "#6bb8ff", inkColor: "#edf1f7" },
    light: { islandBackgroundColor: "#f4f6f9", taskTextColor: "#161a22", pulseColor: "#2267cc", inkColor: "#161a22" },
    glass: glassSet({
      glassStyle: "static", glassColorSource: "accent", glassColorStrength: 10, glassFlowSpeed: 0,
      glassBlobScale: 100, glassFlowWhen: "expanded", glassRim: true, glassRimWidth: 1, glassSheen: false,
      glassSpecular: true, glassMorph: "smooth", glassContrastGuard: true, glassBackdrop: "native",
      glassBlur: 52, glassSaturation: 135, glassNoise: 3, glassIntensity: 81,
    }),
  },
};

export function withBuiltinTheme(settings: IslandSettings, id: BuiltinThemeId): IslandSettings {
  const theme = BUILTIN_THEMES[id];
  const colored = withThemeColors(withThemeColors(settings, "light", theme.light), "dark", theme.dark);
  const themeMode = settings.themeMode === "system" ? "system" : theme.tone;
  const active = theme[themeMode === "light" ? "light" : "dark"];
  return {
    ...colored,
    ...active,
    ...(theme.glass ?? {}),
    appearanceMode: theme.appearanceMode,
    opacity: theme.opacity,
    islandOpacity: theme.islandOpacity,
    fontFamily: theme.fontFamily,
    fontScale: theme.fontScale,
    islandCornerShape: theme.islandCornerShape,
    islandCornerRadius: theme.islandCornerRadius,
    topFilletRadius: theme.topFilletRadius,
    accentMode: theme.accentMode,
    accentColor: theme.accentColor,
    pulseBrightness: theme.pulseBrightness,
    themeMode,
  };
}

export function builtinThemeInUse(settings: IslandSettings): BuiltinThemeId | null {
  return BUILTIN_THEME_IDS.find((id) => {
    const theme = BUILTIN_THEMES[id];
    if (!STYLE_KEYS.every((key) => settings[key] === theme[key])) return false;
    if (theme.accentMode === "pick" && !sameHex(settings.accentColor, theme.accentColor)) return false;
    if (theme.glass && !sameGlass(settings, theme.glass)) return false;
    return (["light", "dark"] as const).every((tone) => sameColors(themeColors(settings, tone), theme[tone]));
  }) ?? null;
}

export function builtinThemeColors(id: BuiltinThemeId, settings: IslandSettings, systemDark: boolean): ThemeColors {
  const theme = BUILTIN_THEMES[id];
  return theme[activeTone(settings.themeMode === "system" ? "system" : theme.tone, systemDark)];
}

function sameHex(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

function sameGlass(settings: IslandSettings, glass: BuiltinThemeGlass) {
  if (settings.glassIntensity !== glass.glassIntensity) return false;
  return GLASS_SETTING_KEYS.every((key) => {
    const a = settings[key];
    const b = glass[key];
    return typeof a === "string" && typeof b === "string" ? sameHex(a, b) : a === b;
  });
}

function sameColors(a: ThemeColors, b: ThemeColors) {
  return (Object.keys(b) as (keyof ThemeColors)[]).every((key) => sameHex(a[key], b[key]));
}
