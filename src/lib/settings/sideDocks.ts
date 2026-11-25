import { readString, removeItem, writeJson } from "../storage.ts";
import { setIslandPagePlacement, type EnabledDockSides, type IslandPagesLayout } from "./islandPages.ts";

export const SIDE_DOCKS_KEY = "fuyu-side-docks";
const SETTINGS_VERSION = 1;
const QUICK_STRIP_MAX = 5;

export type SideDockEdge = "left" | "right";
export type SideDockStages = 2 | 3;
export type SideDockAutoDrawer = "auto" | "hover-item" | "click";
export type SideDockTrigger = "hover" | "click";
export type SideDockAppearance = "follow" | "custom";
export type SideDockThemeOverride = "dark" | "light";
export type SideDockMaterialOverride = "glass" | "solid";
export type SideDockStripStyle = "label" | "icon";
export type SideDockHeaderStyle = "full" | "icons" | "minimal";
export type SideDockDensity = "cozy" | "compact";

export type SideDockSideConfig = {
  enabled: boolean;
  along: number;
  pinned: boolean;
  lastPage: string | null;
};

export type SideDocksSettings = {
  left: SideDockSideConfig;
  right: SideDockSideConfig;
  stages: SideDockStages;
  autoDrawer: SideDockAutoDrawer;
  trigger: SideDockTrigger;
  hoverDelayMs: number;
  leaveDelayMs: number;
  drawerWidth: number;
  drawerHeight: number;
  outerRadius: number;
  gap: number;
  handleWidth: number;
  handleHeight: number;
  handleOpacity: number;
  handleDot: boolean;
  appearance: SideDockAppearance;
  theme: SideDockThemeOverride;
  material: SideDockMaterialOverride;
  surfaceOpacity: number;
  stripStyle: SideDockStripStyle;
  headerStyle: SideDockHeaderStyle;
  density: SideDockDensity;
  quickStripItems: string[];
  dragDropShelf: boolean;
  hideInFullscreen: boolean;
};

export const SIDE_DOCK_LIMITS = {
  along: [0.14, 0.86],
  hoverDelayMs: [0, 600],
  leaveDelayMs: [150, 1500],
  drawerWidth: [300, 520],
  drawerHeight: [400, 660],
  outerRadius: [6, 22],
  gap: [0, 14],
  handleWidth: [6, 16],
  handleHeight: [56, 160],
  handleOpacity: [20, 100],
  surfaceOpacity: [45, 100],
} as const;

export const SIDE_DOCK_TOP_CORE_PAGES = ["fuyu", "agents", "music", "timer"] as const;
export const SIDE_DOCK_RECOMMENDED_PAGES = ["todo", "clipboard", "shelf", "screenshots", "translation"] as const;
export const SIDE_DOCK_LEFT_PAGES = ["calendar", "qq"] as const;
export const DEFAULT_QUICK_STRIP_ITEMS = ["page:todo", "page:clipboard", "page:shelf", "act:new-todo"] as const;

const DEFAULT_SIDE: SideDockSideConfig = {
  enabled: false,
  along: 0.5,
  pinned: false,
  lastPage: null,
};

export const DEFAULT_SIDE_DOCKS: SideDocksSettings = {
  left: { ...DEFAULT_SIDE },
  right: { ...DEFAULT_SIDE },
  stages: 3,
  autoDrawer: "auto",
  trigger: "hover",
  hoverDelayMs: 200,
  leaveDelayMs: 360,
  drawerWidth: 380,
  drawerHeight: 540,
  outerRadius: 14,
  gap: 6,
  handleWidth: 9,
  handleHeight: 84,
  handleOpacity: 78,
  handleDot: true,
  appearance: "follow",
  theme: "dark",
  material: "glass",
  surfaceOpacity: 82,
  stripStyle: "label",
  headerStyle: "full",
  density: "cozy",
  quickStripItems: [...DEFAULT_QUICK_STRIP_ITEMS],
  dragDropShelf: true,
  hideInFullscreen: true,
};

function clampNumber(value: unknown, fallback: number, [min, max]: readonly [number, number], round = true): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const clamped = Math.min(max, Math.max(min, value));
  return round ? Math.round(clamped) : clamped;
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function normalizeSide(value: unknown): SideDockSideConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { ...DEFAULT_SIDE };
  const record = value as Record<string, unknown>;
  return {
    enabled: record.enabled === true,
    along: clampNumber(record.along, DEFAULT_SIDE.along, SIDE_DOCK_LIMITS.along, false),
    pinned: record.pinned === true,
    lastPage: typeof record.lastPage === "string" && record.lastPage !== "" ? record.lastPage : null,
  };
}

function normalizeQuickStrip(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_QUICK_STRIP_ITEMS];
  const seen = new Set<string>();
  const valid = value.filter((item): item is string => typeof item === "string" && item !== "" && !seen.has(item) && Boolean(seen.add(item)));
  return valid.length > 0 ? valid.slice(0, QUICK_STRIP_MAX) : [...DEFAULT_QUICK_STRIP_ITEMS];
}

export function innerRadiusFor(outerRadius: number): number {
  return Math.max(5, Math.round(outerRadius) - 6);
}

export function handleRadiusFor(outerRadius: number): number {
  return Math.max(4, Math.round(outerRadius * 0.5));
}

export function normalizeSideDocks(value: unknown): SideDocksSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { ...DEFAULT_SIDE_DOCKS, left: { ...DEFAULT_SIDE }, right: { ...DEFAULT_SIDE }, quickStripItems: [...DEFAULT_QUICK_STRIP_ITEMS] };
  const record = value as Record<string, unknown>;
  const legacyCustom =
    record.appearance === undefined &&
    ((record.theme === "dark" || record.theme === "light") || (record.material === "glass" || record.material === "solid"));
  const appearance: SideDockAppearance = record.appearance === "custom" || legacyCustom ? "custom" : "follow";
  return {
    left: normalizeSide(record.left),
    right: normalizeSide(record.right),
    stages: record.stages === 2 ? 2 : 3,
    autoDrawer: pick(record.autoDrawer, ["auto", "hover-item", "click"] as const, DEFAULT_SIDE_DOCKS.autoDrawer),
    trigger: pick(record.trigger, ["hover", "click"] as const, DEFAULT_SIDE_DOCKS.trigger),
    hoverDelayMs: clampNumber(record.hoverDelayMs, DEFAULT_SIDE_DOCKS.hoverDelayMs, SIDE_DOCK_LIMITS.hoverDelayMs),
    leaveDelayMs: clampNumber(record.leaveDelayMs, DEFAULT_SIDE_DOCKS.leaveDelayMs, SIDE_DOCK_LIMITS.leaveDelayMs),
    drawerWidth: clampNumber(record.drawerWidth, DEFAULT_SIDE_DOCKS.drawerWidth, SIDE_DOCK_LIMITS.drawerWidth),
    drawerHeight: clampNumber(record.drawerHeight, DEFAULT_SIDE_DOCKS.drawerHeight, SIDE_DOCK_LIMITS.drawerHeight),
    outerRadius: clampNumber(record.outerRadius, DEFAULT_SIDE_DOCKS.outerRadius, SIDE_DOCK_LIMITS.outerRadius),
    gap: clampNumber(record.gap, DEFAULT_SIDE_DOCKS.gap, SIDE_DOCK_LIMITS.gap),
    handleWidth: clampNumber(record.handleWidth, DEFAULT_SIDE_DOCKS.handleWidth, SIDE_DOCK_LIMITS.handleWidth),
    handleHeight: clampNumber(record.handleHeight, DEFAULT_SIDE_DOCKS.handleHeight, SIDE_DOCK_LIMITS.handleHeight),
    handleOpacity: clampNumber(record.handleOpacity, DEFAULT_SIDE_DOCKS.handleOpacity, SIDE_DOCK_LIMITS.handleOpacity),
    handleDot: typeof record.handleDot === "boolean" ? record.handleDot : DEFAULT_SIDE_DOCKS.handleDot,
    appearance,
    theme: pick(record.theme, ["dark", "light"] as const, DEFAULT_SIDE_DOCKS.theme),
    material: pick(record.material, ["glass", "solid"] as const, DEFAULT_SIDE_DOCKS.material),
    surfaceOpacity: clampNumber(record.surfaceOpacity, DEFAULT_SIDE_DOCKS.surfaceOpacity, SIDE_DOCK_LIMITS.surfaceOpacity),
    stripStyle: pick(record.stripStyle, ["label", "icon"] as const, DEFAULT_SIDE_DOCKS.stripStyle),
    headerStyle: pick(record.headerStyle, ["full", "icons", "minimal"] as const, DEFAULT_SIDE_DOCKS.headerStyle),
    density: pick(record.density, ["cozy", "compact"] as const, DEFAULT_SIDE_DOCKS.density),
    quickStripItems: normalizeQuickStrip(record.quickStripItems),
    dragDropShelf: typeof record.dragDropShelf === "boolean" ? record.dragDropShelf : DEFAULT_SIDE_DOCKS.dragDropShelf,
    hideInFullscreen: typeof record.hideInFullscreen === "boolean" ? record.hideInFullscreen : DEFAULT_SIDE_DOCKS.hideInFullscreen,
  };
}

export function isDefaultSideDocks(settings: SideDocksSettings): boolean {
  return JSON.stringify(normalizeSideDocks(settings)) === JSON.stringify(DEFAULT_SIDE_DOCKS);
}

export function readSideDocks(raw: string | null): SideDocksSettings {
  try {
    const parsed: unknown = JSON.parse(raw ?? "null");
    if (typeof parsed !== "object" || parsed === null || (parsed as { version?: unknown }).version !== SETTINGS_VERSION) return normalizeSideDocks(null);
    return normalizeSideDocks(parsed);
  } catch {
    return normalizeSideDocks(null);
  }
}

export function loadSideDocks(): SideDocksSettings {
  return readSideDocks(readString(SIDE_DOCKS_KEY));
}

export function saveSideDocks(settings: SideDocksSettings): SideDocksSettings {
  const normalized = normalizeSideDocks(settings);
  if (isDefaultSideDocks(normalized)) removeItem(SIDE_DOCKS_KEY);
  else writeJson(SIDE_DOCKS_KEY, { version: SETTINGS_VERSION, ...normalized });
  return normalized;
}

export function sideDockEnabledSides(settings: SideDocksSettings, islandSide: SideDockEdge | null = null): EnabledDockSides {
  return {
    left: settings.left.enabled && islandSide !== "left",
    right: settings.right.enabled && islandSide !== "right",
  };
}

const TOP_CORE_SET = new Set<string>(SIDE_DOCK_TOP_CORE_PAGES);
const RIGHT_AFFINITY_SET = new Set<string>(SIDE_DOCK_RECOMMENDED_PAGES);
const LEFT_AFFINITY_SET = new Set<string>(SIDE_DOCK_LEFT_PAGES);
const SINGLE_SIDE_MAX = 4;

export type SideDockSplitOptions = {
  pageIds?: readonly string[];
  preferredEdge?: SideDockEdge;
};

export function applySideDockSplitPreset(
  settings: SideDocksSettings,
  layout: IslandPagesLayout,
  options: SideDockSplitOptions | SideDockEdge = {},
): { settings: SideDocksSettings; layout: IslandPagesLayout } {
  const opts: SideDockSplitOptions = typeof options === "string" ? { preferredEdge: options } : options;
  const hiddenSet = new Set(layout.hidden);
  const candidates = (opts.pageIds ?? [...SIDE_DOCK_TOP_CORE_PAGES, ...SIDE_DOCK_RECOMMENDED_PAGES, ...SIDE_DOCK_LEFT_PAGES])
    .filter((id, index, list) => !hiddenSet.has(id) && list.indexOf(id) === index);

  const topIds: string[] = [];
  const offloadIds: string[] = [];
  for (const id of candidates) {
    if (TOP_CORE_SET.has(id)) topIds.push(id);
    else offloadIds.push(id);
  }
  if (topIds.length === 0 && offloadIds.length > 0) {
    const first = offloadIds.shift();
    if (first) topIds.push(first);
  }

  const leftOn = settings.left.enabled;
  const rightOn = settings.right.enabled;
  const useBoth =
    (leftOn && rightOn) ||
    offloadIds.length > SINGLE_SIDE_MAX ||
    (!leftOn && !rightOn && opts.preferredEdge === undefined && offloadIds.some((id) => !RIGHT_AFFINITY_SET.has(id)));

  const leftIds: string[] = [];
  const rightIds: string[] = [];

  if (!useBoth) {
    const target: SideDockEdge =
      opts.preferredEdge ?? (leftOn && !rightOn ? "left" : "right");
    if (target === "left") leftIds.push(...offloadIds);
    else rightIds.push(...offloadIds);
  } else {
    const neutral: string[] = [];
    for (const id of offloadIds) {
      if (RIGHT_AFFINITY_SET.has(id)) rightIds.push(id);
      else if (LEFT_AFFINITY_SET.has(id)) leftIds.push(id);
      else neutral.push(id);
    }
    for (const id of neutral) {
      if (leftIds.length <= rightIds.length) leftIds.push(id);
      else rightIds.push(id);
    }
    while (leftIds.length === 0 && rightIds.length >= 2) {
      const moved = rightIds.pop();
      if (moved) leftIds.push(moved);
    }
    while (rightIds.length === 0 && leftIds.length >= 2) {
      const moved = leftIds.pop();
      if (moved) rightIds.push(moved);
    }
    while (leftIds.length - rightIds.length > 2) {
      const moved = leftIds.pop();
      if (moved) rightIds.push(moved);
    }
    while (rightIds.length - leftIds.length > 2) {
      const moved = rightIds.pop();
      if (moved) leftIds.push(moved);
    }
  }

  let nextLayout = layout;
  for (const id of topIds) nextLayout = setIslandPagePlacement(nextLayout, id, "top");
  for (const id of leftIds) nextLayout = setIslandPagePlacement(nextLayout, id, "left");
  for (const id of rightIds) nextLayout = setIslandPagePlacement(nextLayout, id, "right");

  const nextLeftEnabled = leftIds.length > 0 ? true : settings.left.enabled;
  const nextRightEnabled = rightIds.length > 0 ? true : settings.right.enabled;
  const nextLeftPage = leftIds.includes(settings.left.lastPage ?? "") ? settings.left.lastPage : (leftIds[0] ?? settings.left.lastPage);
  const nextRightPage = rightIds.includes(settings.right.lastPage ?? "") ? settings.right.lastPage : (rightIds[0] ?? settings.right.lastPage);

  const nextSettings: SideDocksSettings = {
    ...settings,
    left: { ...settings.left, enabled: nextLeftEnabled, lastPage: nextLeftPage },
    right: { ...settings.right, enabled: nextRightEnabled, lastPage: nextRightPage },
  };
  return { settings: normalizeSideDocks(nextSettings), layout: nextLayout };
}
