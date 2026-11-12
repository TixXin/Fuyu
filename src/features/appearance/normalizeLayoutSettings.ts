import { clamp } from "../../utils/number.ts";
import { getColorSetting } from "../../utils/color.ts";
import { DEFAULT_SETTINGS, LEGACY_FALLBACKS } from "./settingsDefaults.ts";
import {
  MAX_ISLAND_CORNER_RADIUS, MAX_MAX_PANEL_HEIGHT, MAX_TOP_FILLET_RADIUS,
  MIN_ISLAND_CORNER_RADIUS, MIN_MAX_PANEL_HEIGHT, MIN_TOP_FILLET_RADIUS,
  MAX_PANEL_WIDTH, MIN_PANEL_WIDTH, MAX_COLLAPSED_WIDTH_EXTRA, MIN_COLLAPSED_WIDTH_EXTRA,
} from "./settingsLimits.ts";
import { hasThemeSets, THEME_COLOR_KEYS, THEME_COLORS, THEME_MODES, themeSetsFromSingleColors } from "./themeMode.ts";
import { oneOf } from "./settingsLimits.ts";
import { ISLAND_MOTIONS } from "./islandMotion.ts";
import type { IslandSettings, LegacyIslandSettings } from "./types";

export function normalizeLayoutSettings(settings: LegacyIslandSettings | null | undefined) {
  const taskTextColor = getColorSetting(
    settings?.taskTextColor ?? settings?.pendingTodoColor,
    getColorSetting(settings?.taskTitleColor, DEFAULT_SETTINGS.taskTextColor),
  );
  const hasPreviousDefaultScales =
    settings?.collapsedScale === 0.81 && settings.expandedScale === 0.88;
  const collapsedScale = hasPreviousDefaultScales
    ? 0.82
    : settings?.collapsedScale ?? settings?.sizeScale ?? DEFAULT_SETTINGS.collapsedScale;
  const expandedScale = hasPreviousDefaultScales
    ? 1.05
    : settings?.expandedScale ?? settings?.sizeScale ?? DEFAULT_SETTINGS.expandedScale;
  const marginY = settings?.marginY ?? settings?.margin ?? DEFAULT_SETTINGS.marginY;
  const hasPreviousDefaultMargin =
    settings?.topEdgeLayoutVersion !== 1 && (marginY === 31 || marginY === 12);

  return {
    topEdgeLayoutVersion: 1,
    fontFamily: settings?.fontFamily === "pixel" ? "pixel" : "system",
    appearanceMode:
      settings?.appearanceMode === "classic" ||
      settings?.appearanceMode === "liquidGlass"
        ? settings.appearanceMode
        : "classic",
    glassIntensity: clamp(
      Number(settings?.glassIntensity ?? DEFAULT_SETTINGS.glassIntensity),
      25,
      100,
    ),
    opacity: clamp(Number(settings?.opacity ?? DEFAULT_SETTINGS.opacity), 50, 100),
    collapsedScale: clamp(Number(collapsedScale), 0.75, 1.4),
    expandedScale: clamp(Number(expandedScale), 0.75, 1.4),
    islandMonitor: settings?.islandMonitor === "cursor" || settings?.islandMonitor === "foreground" ? settings.islandMonitor : "primary",
    marginY: clamp(
      Number(hasPreviousDefaultMargin ? DEFAULT_SETTINGS.marginY : marginY),
      0,
      160,
    ),
    topFilletRadius: typeof settings?.topFilletRadius === "number" && Number.isFinite(settings.topFilletRadius)
      ? clamp(Math.round(settings.topFilletRadius), MIN_TOP_FILLET_RADIUS, MAX_TOP_FILLET_RADIUS)
      : LEGACY_FALLBACKS.topFilletRadius,
    islandCornerRadius: typeof settings?.islandCornerRadius === "number" && Number.isFinite(settings.islandCornerRadius)
      ? clamp(Math.round(settings.islandCornerRadius), MIN_ISLAND_CORNER_RADIUS, MAX_ISLAND_CORNER_RADIUS)
      : LEGACY_FALLBACKS.islandCornerRadius,
    islandCornerShape: settings?.islandCornerShape === "round" ? "round" : "squircle",
    islandMotion: oneOf(ISLAND_MOTIONS, settings?.islandMotion, DEFAULT_SETTINGS.islandMotion),
    maxPanelHeight: typeof settings?.maxPanelHeight === "number" && Number.isFinite(settings.maxPanelHeight)
      ? clamp(Math.round(settings.maxPanelHeight), MIN_MAX_PANEL_HEIGHT, MAX_MAX_PANEL_HEIGHT)
      : LEGACY_FALLBACKS.maxPanelHeight,
    panelWidth: typeof settings?.panelWidth === "number" && Number.isFinite(settings.panelWidth)
      ? clamp(Math.round(settings.panelWidth), MIN_PANEL_WIDTH, MAX_PANEL_WIDTH)
      : LEGACY_FALLBACKS.panelWidth,
    collapsedWidthExtra: typeof settings?.collapsedWidthExtra === "number" && Number.isFinite(settings.collapsedWidthExtra)
      ? clamp(Math.round(settings.collapsedWidthExtra), MIN_COLLAPSED_WIDTH_EXTRA, MAX_COLLAPSED_WIDTH_EXTRA)
      : DEFAULT_SETTINGS.collapsedWidthExtra,
    taskTextColor,
    pulseColor: getColorSetting(
      settings?.pulseColor,
      DEFAULT_SETTINGS.pulseColor,
    ),
    pulseBrightness: clamp(
      Number(settings?.pulseBrightness ?? LEGACY_FALLBACKS.pulseBrightness),
      50,
      160,
    ),
    islandBackgroundColor: getColorSetting(
      settings?.islandBackgroundColor,
      LEGACY_FALLBACKS.islandBackgroundColor,
    ),
    ...normalizeThemeSets(settings),
    collapsedDark: typeof settings?.collapsedDark === "boolean" ? settings.collapsedDark : LEGACY_FALLBACKS.collapsedDark,
    accentMode: oneOf(["default", "windows", "pick"] as const, settings?.accentMode, DEFAULT_SETTINGS.accentMode),
    accentColor: getColorSetting(settings?.accentColor, DEFAULT_SETTINGS.accentColor),
    showTitle:
      typeof settings?.showTitle === "boolean"
        ? settings.showTitle
        : DEFAULT_SETTINGS.showTitle,
    showCollapsedText:
      typeof settings?.showCollapsedText === "boolean"
        ? settings.showCollapsedText
        : DEFAULT_SETTINGS.showCollapsedText,
  } satisfies Partial<IslandSettings>;
}

function normalizeThemeSets(settings: LegacyIslandSettings | null | undefined) {
  const source = (settings ?? {}) as Record<string, unknown>;
  const merged = hasThemeSets(source) ? source : { ...source, ...themeSetsFromSingleColors(source) };
  const sets = Object.fromEntries(
    (["dark", "light"] as const).flatMap((tone) =>
      (Object.entries(THEME_COLOR_KEYS[tone]) as [keyof typeof THEME_COLORS.dark, string][]).map(([name, key]) => [
        key,
        getColorSetting(merged[key], THEME_COLORS[tone][name]),
      ]),
    ),
  ) as Pick<IslandSettings, "darkBackgroundColor" | "darkTextColor" | "darkPulseColor" | "lightBackgroundColor" | "lightTextColor" | "lightPulseColor">;
  return { themeMode: oneOf(THEME_MODES, merged.themeMode, DEFAULT_SETTINGS.themeMode), ...sets };
}
