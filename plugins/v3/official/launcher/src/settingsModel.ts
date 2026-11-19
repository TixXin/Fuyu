export type EmptyView = "recent" | "all";

export interface LauncherSettings {
  emptyView: EmptyView;
  recentShown: number;
  autoCollapse: boolean;
  showFolder: boolean;
  showCount: boolean;
  rescanMinutes: number;
  recordRecent: boolean;
  historyLimit: number;
  excluded: string[];
  extraDirs: string[];
}

export const RECENT_SHOWN_OPTIONS = [4, 8, 12, 16] as const;
export const RESCAN_OPTIONS = [5, 30, 120, 0] as const;
export const HISTORY_OPTIONS = [20, 50, 100, 200] as const;
export const MAX_EXCLUDED = 200;
export const MAX_EXTRA_DIRS = 20;

export const DEFAULT_SETTINGS: LauncherSettings = {
  emptyView: "recent",
  recentShown: 8,
  autoCollapse: true,
  showFolder: false,
  showCount: false,
  rescanMinutes: 5,
  recordRecent: true,
  historyLimit: 200,
  excluded: [],
  extraDirs: [],
};

function pick<T extends number>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === "number" && (options as readonly number[]).includes(value) ? (value as T) : fallback;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizePaths(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
    if (result.length >= max) break;
  }
  return result;
}

export function normalizeSettings(raw: unknown, base: LauncherSettings = DEFAULT_SETTINGS): LauncherSettings {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    emptyView: input.emptyView === "all" || input.emptyView === "recent" ? input.emptyView : base.emptyView,
    recentShown: pick(input.recentShown, RECENT_SHOWN_OPTIONS, base.recentShown),
    autoCollapse: flag(input.autoCollapse, base.autoCollapse),
    showFolder: flag(input.showFolder, base.showFolder),
    showCount: flag(input.showCount, base.showCount),
    rescanMinutes: pick(input.rescanMinutes, RESCAN_OPTIONS, base.rescanMinutes),
    recordRecent: flag(input.recordRecent, base.recordRecent),
    historyLimit: pick(input.historyLimit, HISTORY_OPTIONS, base.historyLimit),
    excluded: "excluded" in input ? normalizePaths(input.excluded, MAX_EXCLUDED) : base.excluded,
    extraDirs: "extraDirs" in input ? normalizePaths(input.extraDirs, MAX_EXTRA_DIRS) : base.extraDirs,
  };
}
