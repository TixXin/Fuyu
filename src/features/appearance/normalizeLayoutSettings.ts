// Reading saved settings, part 1 (normalizeSettings in settings.ts): the island's look and size.
import { clamp } from "../../utils/number.ts";
import { getColorSetting } from "../../utils/color.ts";
import { DEFAULT_SETTINGS, LEGACY_FALLBACKS } from "./settingsDefaults.ts";
import {
  MAX_ISLAND_CORNER_RADIUS, MAX_MAX_PANEL_HEIGHT, MAX_TOP_FILLET_RADIUS,
  MIN_ISLAND_CORNER_RADIUS, MIN_MAX_PANEL_HEIGHT, MIN_TOP_FILLET_RADIUS,
  MAX_PANEL_WIDTH, MIN_PANEL_WIDTH,
} from "./settingsLimits.ts";
import { THEME_MODES } from "./themeMode.ts";
import { oneOf } from "./settingsLimits.ts";
import type { IslandSettings, LegacyIslandSettings } from "./types";

/** The look and size: scales, margin, corners, panel height, colours, what the bar shows. */
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
    ? 1.05 // The default these settings moved to back then, not today's.
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
    // Squircle for upgrades too: it replaced the round corners as the island's look.
    islandCornerShape: settings?.islandCornerShape === "round" ? "round" : "squircle",
    maxPanelHeight: typeof settings?.maxPanelHeight === "number" && Number.isFinite(settings.maxPanelHeight)
      ? clamp(Math.round(settings.maxPanelHeight), MIN_MAX_PANEL_HEIGHT, MAX_MAX_PANEL_HEIGHT)
      : DEFAULT_SETTINGS.maxPanelHeight,
    // Older settings had no width: the panel was 560px.
    panelWidth: typeof settings?.panelWidth === "number" && Number.isFinite(settings.panelWidth)
      ? clamp(Math.round(settings.panelWidth), MIN_PANEL_WIDTH, MAX_PANEL_WIDTH)
      : DEFAULT_SETTINGS.panelWidth,
    taskTextColor,
    pulseColor: getColorSetting(
      settings?.pulseColor,
      DEFAULT_SETTINGS.pulseColor,
    ),
    pulseBrightness: clamp(
      Number(settings?.pulseBrightness ?? DEFAULT_SETTINGS.pulseBrightness),
      50,
      160,
    ),
    islandBackgroundColor: getColorSetting(
      settings?.islandBackgroundColor,
      DEFAULT_SETTINGS.islandBackgroundColor,
    ),
    themeMode: oneOf(THEME_MODES, settings?.themeMode, LEGACY_FALLBACKS.themeMode),
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
