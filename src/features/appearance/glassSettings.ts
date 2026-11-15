import { clamp } from "../../utils/number.ts";
import { HEX_COLOR_PATTERN } from "../../utils/color.ts";
import { oneOf } from "./settingsLimits.ts";

export const GLASS_STYLES = ["static", "flow", "aurora", "shader"] as const;
export const GLASS_COLOR_SOURCES = ["accent", "cover", "custom"] as const;
export const GLASS_FLOW_WHEN = ["always", "expanded"] as const;
export const GLASS_MORPHS = ["smooth", "soft", "liquid"] as const;

export type GlassStyle = (typeof GLASS_STYLES)[number];
export type GlassColorSource = (typeof GLASS_COLOR_SOURCES)[number];
export type GlassFlowWhen = (typeof GLASS_FLOW_WHEN)[number];
export type GlassMorph = (typeof GLASS_MORPHS)[number];

export type GlassSettingValues = {
  glassStyle: GlassStyle;
  glassColorSource: GlassColorSource;
  glassColor1: string;
  glassColor2: string;
  glassColor3: string;
  glassColorStrength: number;
  glassFlowSpeed: number;
  glassBlobScale: number;
  glassFlowWhen: GlassFlowWhen;
  glassRim: boolean;
  glassRimWidth: number;
  glassSheen: boolean;
  glassSpecular: boolean;
  glassMorph: GlassMorph;
  glassContrastGuard: boolean;
};

export const GLASS_SETTING_KEYS = [
  "glassStyle",
  "glassColorSource",
  "glassColor1",
  "glassColor2",
  "glassColor3",
  "glassColorStrength",
  "glassFlowSpeed",
  "glassBlobScale",
  "glassFlowWhen",
  "glassRim",
  "glassRimWidth",
  "glassSheen",
  "glassSpecular",
  "glassMorph",
  "glassContrastGuard",
] as const satisfies readonly (keyof GlassSettingValues)[];

export const DEFAULT_GLASS_SETTINGS: GlassSettingValues = {
  glassStyle: "flow",
  glassColorSource: "accent",
  glassColor1: "",
  glassColor2: "",
  glassColor3: "",
  glassColorStrength: 70,
  glassFlowSpeed: 100,
  glassBlobScale: 100,
  glassFlowWhen: "always",
  glassRim: false,
  glassRimWidth: 1.5,
  glassSheen: false,
  glassSpecular: true,
  glassMorph: "smooth",
  glassContrastGuard: true,
};

function percent(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? clamp(Math.round(value), min, max) : fallback;
}

function hexOrEmpty(value: unknown) {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value) ? value : "";
}

export function normalizeGlassSettings(saved: Partial<Record<keyof GlassSettingValues, unknown>> | null | undefined): GlassSettingValues {
  const defaults = DEFAULT_GLASS_SETTINGS;
  const rimWidth = saved?.glassRimWidth;
  return {
    glassStyle: oneOf(GLASS_STYLES, saved?.glassStyle, defaults.glassStyle),
    glassColorSource: oneOf(GLASS_COLOR_SOURCES, saved?.glassColorSource, defaults.glassColorSource),
    glassColor1: hexOrEmpty(saved?.glassColor1),
    glassColor2: hexOrEmpty(saved?.glassColor2),
    glassColor3: hexOrEmpty(saved?.glassColor3),
    glassColorStrength: percent(saved?.glassColorStrength, 0, 100, defaults.glassColorStrength),
    glassFlowSpeed: percent(saved?.glassFlowSpeed, 0, 200, defaults.glassFlowSpeed),
    glassBlobScale: percent(saved?.glassBlobScale, 60, 160, defaults.glassBlobScale),
    glassFlowWhen: oneOf(GLASS_FLOW_WHEN, saved?.glassFlowWhen, defaults.glassFlowWhen),
    glassRim: saved?.glassRim === true,
    glassRimWidth: typeof rimWidth === "number" && Number.isFinite(rimWidth)
      ? clamp(Math.round(rimWidth * 2) / 2, 1, 3)
      : defaults.glassRimWidth,
    glassSheen: saved?.glassSheen === true,
    glassSpecular: saved?.glassSpecular !== false,
    glassMorph: oneOf(GLASS_MORPHS, saved?.glassMorph, defaults.glassMorph),
    glassContrastGuard: saved?.glassContrastGuard !== false,
  };
}
