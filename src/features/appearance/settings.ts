import { HEX_COLOR_PATTERN } from "../../utils/color.ts";
import { normalizeAgentSettings } from "./normalizeAgentSettings.ts";
import { normalizeBehaviorSettings } from "./normalizeBehaviorSettings.ts";
import { normalizeLayoutSettings } from "./normalizeLayoutSettings.ts";
import { DEFAULT_SETTINGS } from "./settingsDefaults.ts";
import { MAX_CUSTOM_SETTING_PRESETS } from "./settingsLimits.ts";
import type { IslandPreset, IslandSettings, LegacyIslandSettings } from "./types";

export * from "./settingsLimits.ts";
export { DEFAULT_SETTINGS } from "./settingsDefaults.ts";

export const THEME_SETTING_KEYS = [
  "themeMode",
  "collapsedDark",
  "panelDark",
  "windowsDark",
  "accentMode",
  "accentColor",
  "darkBackgroundColor",
  "darkTextColor",
  "darkPulseColor",
  "lightBackgroundColor",
  "lightTextColor",
  "lightPulseColor",
  "appearanceMode",
  "fontFamily",
  "glassIntensity",
  "opacity",
  "topFilletRadius",
  "islandCornerRadius",
  "islandCornerShape",
  "taskTextColor",
  "pulseColor",
  "pulseBrightness",
  "islandBackgroundColor",
] as const satisfies readonly (keyof IslandSettings)[];

export const LAYOUT_SETTING_KEYS = [
  "collapsedScale",
  "expandedScale",
  "maxPanelHeight",
  "panelWidth",
  "collapsedWidthExtra",
  "showTitle",
  "showCollapsedText",
] as const satisfies readonly (keyof IslandSettings)[];

function withKeysFrom(keys: readonly (keyof IslandSettings)[], settings: IslandSettings, source: IslandSettings): IslandSettings {
  return { ...settings, ...Object.fromEntries(keys.map((key) => [key, source[key]])) };
}

export function withThemeFrom(settings: IslandSettings, source: IslandSettings): IslandSettings {
  return withKeysFrom(THEME_SETTING_KEYS, settings, source);
}

export function withLayoutFrom(settings: IslandSettings, source: IslandSettings): IslandSettings {
  return withKeysFrom(LAYOUT_SETTING_KEYS, settings, source);
}

export const LEGACY_DEFAULT_PRESET_IDS = new Set(["default-white", "default-khaki"]);
export const LEGACY_DEFAULT_PRESET_NAMES = new Set(["白色", "卡其"]);

export function hexToRgba(hex: string, alpha: number) {
  const normalized = HEX_COLOR_PATTERN.test(hex)
    ? hex.slice(1)
    : DEFAULT_SETTINGS.pulseColor.slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function normalizeSettings(
  settings: LegacyIslandSettings | null | undefined,
): IslandSettings {
  return {
    ...normalizeLayoutSettings(settings),
    ...normalizeAgentSettings(settings),
    ...normalizeBehaviorSettings(settings),
  };
}

export function getDefaultSettingPresets(): IslandPreset[] {
  return [];
}

export function mergeWithDefaultSettingPresets(presets: IslandPreset[]) {
  const defaultPresets = getDefaultSettingPresets();
  const customPresets = presets
    .filter(
      (preset) =>
        !preset.isDefault &&
        !LEGACY_DEFAULT_PRESET_IDS.has(preset.id) &&
        !LEGACY_DEFAULT_PRESET_NAMES.has(preset.name.trim()),
    )
    .map((preset) => ({ ...preset, isDefault: false }))
    .slice(0, MAX_CUSTOM_SETTING_PRESETS);

  return [...defaultPresets, ...customPresets];
}

export function isDefaultSettingPreset(presetId: string) {
  return LEGACY_DEFAULT_PRESET_IDS.has(presetId);
}

export function isSameSettings(a: IslandSettings, b: IslandSettings) {
  return (Object.keys(a) as (keyof IslandSettings)[]).every(
    (key) => a[key] === b[key],
  );
}
