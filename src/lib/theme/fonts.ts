import { clamp } from "../../utils/number.ts";
import { CUSTOM_FONT_ID_PATTERN, DEFAULT_FONT_SCALE, MAX_FONT_SCALE, MIN_FONT_SCALE } from "../settings/settingsLimits.ts";
import type { IslandFont, IslandSettings } from "../settings/types";

export const SYSTEM_FONT_STACK = '"Segoe UI Variable Text", "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", system-ui, sans-serif';
export const ROUNDED_FONT_STACK = 'ui-rounded, "SF Pro Rounded", "PingFang SC", "Microsoft YaHei UI", system-ui, sans-serif';
export const SERIF_FONT_STACK = '"Songti SC", "STSong", "Noto Serif CJK SC", "SimSun", Georgia, serif';
export const MONO_FONT_STACK = '"JetBrains Mono", "Cascadia Code", "SF Mono", ui-monospace, "Cascadia Mono", Consolas, "Microsoft YaHei UI", monospace';
export const PIXEL_FONT_STACK = '"Fusion Pixel", "Microsoft YaHei", sans-serif';

export type BuiltinFontStyle = Exclude<IslandFont, "custom">;

export const BUILTIN_FONT_STYLES: readonly BuiltinFontStyle[] = ["system", "pixel", "rounded", "serif", "mono"];

export const MAX_CUSTOM_FONT_BYTES = 32 * 1024 * 1024;
export const ACCEPTED_FONT_EXTENSIONS = [".ttf", ".otf", ".woff", ".woff2"] as const;

export function isValidCustomFontId(id: string) {
  return CUSTOM_FONT_ID_PATTERN.test(id);
}

export function customFontFaceName(id: string) {
  return `FuyuCustomFont-${id}`;
}

export function fontScaleFactor(fontScale: number) {
  if (!Number.isFinite(fontScale)) return 1;
  return clamp(Math.round(fontScale), MIN_FONT_SCALE, MAX_FONT_SCALE) / 100;
}

export function fontScaleCssValue(fontScale: number) {
  const rounded = Number.isFinite(fontScale) ? clamp(Math.round(fontScale), MIN_FONT_SCALE, MAX_FONT_SCALE) : DEFAULT_FONT_SCALE;
  if (rounded === DEFAULT_FONT_SCALE) return null;
  return String(rounded / 100);
}

export function uiFontStackFor(
  fontFamily: IslandFont,
  customFontId: string,
  loadedCustomIds?: ReadonlySet<string>,
): string | null {
  switch (fontFamily) {
    case "rounded":
      return ROUNDED_FONT_STACK;
    case "serif":
      return SERIF_FONT_STACK;
    case "mono":
      return MONO_FONT_STACK;
    case "custom":
      if (!isValidCustomFontId(customFontId)) return null;
      if (loadedCustomIds && !loadedCustomIds.has(customFontId)) return null;
      return `"${customFontFaceName(customFontId)}", ${SYSTEM_FONT_STACK}`;
    case "system":
    case "pixel":
    default:
      return null;
  }
}

export function previewFontStackFor(
  settings: Pick<IslandSettings, "fontFamily" | "customFontId">,
  loadedCustomIds?: ReadonlySet<string>,
): string | null {
  if (settings.fontFamily === "pixel") return PIXEL_FONT_STACK;
  return uiFontStackFor(settings.fontFamily, settings.customFontId, loadedCustomIds);
}
