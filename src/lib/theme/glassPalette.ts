import { HEX_COLOR_PATTERN, relativeLuminance } from "../../utils/color.ts";
import type { GlassSettingValues } from "../settings/glassSettings.ts";

export type GlassPalette = readonly [string, string, string];

export const GLASS_DARK_MAX_LUMINANCE = 0.1;
export const GLASS_LIGHT_MIN_LUMINANCE = 0.62;
const LIGHT_BACKGROUND_LUMINANCE = 0.18;
const BASE_FLOW_SECONDS = 23;
const DEFAULT_DARK_ACCENT = "#74d6ff";
const DEFAULT_LIGHT_ACCENT = "#0a7fd1";

type Rgb = [number, number, number];
type Hsl = [number, number, number];

function hexToRgb(hex: string): Rgb {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)) as Rgb;
}

function rgbToHex(rgb: Rgb) {
  return `#${rgb.map((value) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0")).join("")}`;
}

function rgbToHsl([red, green, blue]: Rgb): Hsl {
  const [r, g, b] = [red / 255, green / 255, blue / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness];
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const hue = max === r ? (g - b) / delta + (g < b ? 6 : 0) : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return [hue * 60, saturation, lightness];
}

function hslToHex([hue, saturation, lightness]: Hsl) {
  const h = (((hue % 360) + 360) % 360) / 360;
  const s = Math.min(1, Math.max(0, saturation));
  const l = Math.min(1, Math.max(0, lightness));
  if (s === 0) return rgbToHex([l * 255, l * 255, l * 255]);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return rgbToHex([channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255]);
}

export function derivePalette(base: string): GlassPalette {
  const [hue, saturation, lightness] = rgbToHsl(hexToRgb(base));
  return [
    base.toLowerCase(),
    hslToHex([hue + 48, Math.min(1, saturation * 1.05), lightness]),
    hslToHex([hue - 62, saturation * 0.95, Math.min(0.7, lightness)]),
  ];
}

export function guardColor(color: string, backgroundLuminance: number) {
  const [hue, saturation0] = rgbToHsl(hexToRgb(color));
  const saturation = Math.min(1, saturation0 * 1.1);
  const lightBackground = backgroundLuminance > LIGHT_BACKGROUND_LUMINANCE;
  let low = 0;
  let high = 1;
  const fits = (lightness: number) => {
    const luminance = relativeLuminance(hslToHex([hue, saturation, lightness]));
    return lightBackground ? luminance >= GLASS_LIGHT_MIN_LUMINANCE : luminance <= GLASS_DARK_MAX_LUMINANCE;
  };
  const current = rgbToHsl(hexToRgb(color))[2];
  if (fits(current)) return hslToHex([hue, saturation, current]);
  for (let step = 0; step < 24; step += 1) {
    const middle = (low + high) / 2;
    if (fits(middle) === lightBackground) high = middle;
    else low = middle;
  }
  return hslToHex([hue, saturation, lightBackground ? high : low]);
}

export type GlassPaletteInput = {
  settings: Pick<GlassSettingValues, "glassColorSource" | "glassColor1" | "glassColor2" | "glassColor3" | "glassContrastGuard">;
  accent: string | null;
  cover: string | null;
  background: string;
  backgroundLuminance?: number;
};

export function glassPalette({ settings, accent, cover, background, backgroundLuminance }: GlassPaletteInput): GlassPalette {
  const luminance = backgroundLuminance ?? relativeLuminance(background);
  const fallbackAccent = luminance > LIGHT_BACKGROUND_LUMINANCE ? DEFAULT_LIGHT_ACCENT : DEFAULT_DARK_ACCENT;
  const themeAccent = accent && HEX_COLOR_PATTERN.test(accent) ? accent : fallbackAccent;
  const derived = derivePalette(settings.glassColorSource === "cover" && cover && HEX_COLOR_PATTERN.test(cover) ? cover : themeAccent);
  const raw: GlassPalette = settings.glassColorSource === "custom"
    ? [settings.glassColor1 || derived[0], settings.glassColor2 || derived[1], settings.glassColor3 || derived[2]]
    : derived;
  if (!settings.glassContrastGuard) return raw;
  return raw.map((color) => guardColor(color, luminance)) as unknown as GlassPalette;
}

export function glassVariables(
  settings: Pick<GlassSettingValues, "glassColorStrength" | "glassFlowSpeed" | "glassBlobScale" | "glassRimWidth" | "glassBlur" | "glassSaturation" | "glassNoise">,
  palette: GlassPalette,
): Record<string, string> {
  const speed = Math.max(settings.glassFlowSpeed, 1) / 100;
  return {
    "--glass-c1": palette[0],
    "--glass-c2": palette[1],
    "--glass-c3": palette[2],
    "--glass-color-strength": String(settings.glassColorStrength / 100),
    "--glass-flow-duration": `${(BASE_FLOW_SECONDS / speed).toFixed(2)}s`,
    "--glass-blob-scale": String(settings.glassBlobScale / 100),
    "--glass-rim-width": `${settings.glassRimWidth}px`,
    "--glass-blur": `${settings.glassBlur}px`,
    "--glass-saturation": String(settings.glassSaturation / 100),
    "--glass-noise": String(settings.glassNoise / 100),
  };
}

export type GlassMotionState = {
  mode: "collapsed" | "expanded";
  isTucked: boolean;
  quiet: boolean;
  hidden: boolean;
  reducedMotion: boolean;
};

export function glassPaused(settings: Pick<GlassSettingValues, "glassStyle" | "glassFlowSpeed" | "glassFlowWhen">, state: GlassMotionState) {
  return settings.glassStyle === "static"
    || settings.glassFlowSpeed === 0
    || state.isTucked
    || state.quiet
    || state.hidden
    || state.reducedMotion
    || (settings.glassFlowWhen === "expanded" && state.mode === "collapsed");
}

export function glassClassNames(
  settings: Pick<GlassSettingValues, "glassStyle" | "glassRim" | "glassSheen" | "glassSpecular" | "glassMorph">,
  paused: boolean,
  hidden = false,
) {
  return [
    `island--glass-style-${settings.glassStyle}`,
    `island--glass-morph-${settings.glassMorph}`,
    settings.glassRim ? "island--glass-rim" : "",
    settings.glassSheen ? "island--glass-sheen" : "",
    settings.glassSpecular ? "island--glass-specular" : "",
    paused ? "island--glass-paused" : "",
    hidden ? "island--glass-hidden" : "",
  ].filter(Boolean).join(" ");
}

export const GLASS_STYLE_PRESETS: Record<GlassSettingValues["glassStyle"], Partial<GlassSettingValues>> = {
  static: { glassFlowSpeed: 0, glassRim: false, glassSheen: false, glassSpecular: true, glassMorph: "smooth" },
  flow: { glassFlowSpeed: 100, glassRim: false, glassSheen: false, glassSpecular: true, glassMorph: "smooth" },
  aurora: { glassFlowSpeed: 100, glassRim: true, glassSheen: true, glassSpecular: true, glassMorph: "soft" },
  shader: { glassFlowSpeed: 100, glassRim: false, glassSheen: false, glassSpecular: false, glassMorph: "smooth" },
};
