import { DEFAULT_SETTINGS, type LauncherSettings } from "./settingsModel.ts";

export interface AppEntry {
  id: string;
  name: string;
  path: string;
  folder: string;
}

export interface AppUsageRecord {
  count: number;
  lastLaunchedAt: number;
}

export type AppUsageMap = Record<string, AppUsageRecord>;

export interface RankedApp extends AppEntry {
  count: number;
  lastLaunchedAt: number;
  recent: boolean;
}

export interface ExcludedApp {
  path: string;
  name: string;
}

export interface LauncherState {
  apps: RankedApp[];
  excludedApps: ExcludedApp[];
  totalCount: number;
  recentCount: number;
  scannedAt: number;
  updatedAt: number;
  settings: LauncherSettings;
}

export const MAX_RECENT_ENTRIES = 200;

export const METHODS = {
  getState: "getState",
  rescan: "rescan",
  launch: "launch",
  clearRecent: "clearRecent",
  setSettings: "setSettings",
  addExtraDir: "addExtraDir",
} as const;

export const TOPICS = {
  state: "state",
} as const;

export const EMPTY_STATE: LauncherState = {
  apps: [],
  excludedApps: [],
  totalCount: 0,
  recentCount: 0,
  scannedAt: 0,
  updatedAt: 0,
  settings: DEFAULT_SETTINGS,
};

export function extractAcronyms(name: string): { word: string; camel: string; words: string[] } {
  const words = name
    .split(/[\s._\-/()]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const word = words.map((part) => part[0] ?? "").join("");
  const camelTokens = name
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s._\-/()]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const camel = camelTokens.map((part) => part[0] ?? "").join("");
  return { word, camel, words };
}

function isSubsequence(needle: string, haystack: string): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  let idx = 0;
  for (let i = 0; i < haystack.length && idx < needle.length; i += 1) {
    if (haystack[i] === needle[idx]) idx += 1;
  }
  return idx === needle.length;
}

export function matchAppScore(app: Pick<AppEntry, "name" | "folder">, query: string): number {
  const trimmed = query.trim();
  if (!trimmed) return 1;
  const q = trimmed.toLowerCase();
  const compact = q.replace(/\s+/g, "");
  const lowerName = app.name.toLowerCase();

  if (lowerName === q) return 500;
  if (lowerName.startsWith(q)) return 400;

  const { word, camel, words } = extractAcronyms(app.name);
  if (compact.length > 0 && (camel === compact || word === compact)) return 360;
  if (compact.length > 0 && (camel.startsWith(compact) || word.startsWith(compact))) return 320;
  if (words.some((part) => part.startsWith(q))) return 280;
  if (lowerName.includes(q)) return 200;
  if (compact.length >= 2 && (camel.includes(compact) || word.includes(compact))) return 160;
  if (compact.length >= 2 && isSubsequence(compact, camel)) return 140;
  if (app.folder && app.folder.toLowerCase().includes(q)) return 120;

  return 0;
}

function compareByNameAndPath(a: Pick<AppEntry, "name" | "path">, b: Pick<AppEntry, "name" | "path">): number {
  const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  return byName !== 0 ? byName : a.path.localeCompare(b.path);
}

export function normalizeUsageMap(raw: unknown): AppUsageMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: AppUsageMap = {};
  for (const [appPath, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!appPath || !entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Partial<AppUsageRecord>;
    const count = typeof record.count === "number" && Number.isFinite(record.count) ? Math.floor(record.count) : 0;
    const lastLaunchedAt =
      typeof record.lastLaunchedAt === "number" && Number.isFinite(record.lastLaunchedAt)
        ? Math.floor(record.lastLaunchedAt)
        : 0;
    if (count > 0 && lastLaunchedAt > 0) {
      result[appPath] = { count, lastLaunchedAt };
    }
  }
  return result;
}

export function recordAppLaunch(
  usage: AppUsageMap,
  appPath: string,
  at: number,
  knownPaths?: ReadonlySet<string>,
  limit: number = MAX_RECENT_ENTRIES,
): AppUsageMap {
  const entries = Object.entries(usage).filter(
    ([key, val]) => key !== appPath && val.count > 0 && val.lastLaunchedAt > 0 && (!knownPaths || knownPaths.has(key)),
  );
  const prev = usage[appPath];
  const updated: AppUsageRecord = {
    count: (prev?.count ?? 0) + 1,
    lastLaunchedAt: Math.max(1, Math.floor(at)),
  };
  entries.push([appPath, updated]);
  entries.sort((a, b) => b[1].lastLaunchedAt - a[1].lastLaunchedAt || b[1].count - a[1].count);
  return Object.fromEntries(entries.slice(0, Math.max(1, Math.min(limit, MAX_RECENT_ENTRIES))));
}

export function trimUsage(usage: AppUsageMap, limit: number): AppUsageMap {
  const entries = Object.entries(usage).sort((a, b) => b[1].lastLaunchedAt - a[1].lastLaunchedAt || b[1].count - a[1].count);
  return entries.length <= limit ? usage : Object.fromEntries(entries.slice(0, limit));
}

export function recentApps(apps: readonly RankedApp[], limit: number): RankedApp[] {
  return apps.filter((app) => app.recent).slice(0, Math.max(0, limit));
}

export function sameNameNames(apps: readonly AppEntry[]): Set<string> {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const app of apps) {
    const key = app.name.toLowerCase();
    if (seen.has(key)) dup.add(key);
    seen.add(key);
  }
  return dup;
}

export function rankApps(apps: readonly AppEntry[], usage: AppUsageMap): RankedApp[] {
  const ranked: RankedApp[] = apps.map((app) => {
    const stat = usage[app.path];
    const count = stat && stat.count > 0 ? stat.count : 0;
    const lastLaunchedAt = stat && stat.lastLaunchedAt > 0 ? stat.lastLaunchedAt : 0;
    return {
      ...app,
      count,
      lastLaunchedAt,
      recent: count > 0 && lastLaunchedAt > 0,
    };
  });

  ranked.sort((a, b) => {
    if (a.recent !== b.recent) return a.recent ? -1 : 1;
    if (a.recent && b.recent) {
      if (b.lastLaunchedAt !== a.lastLaunchedAt) return b.lastLaunchedAt - a.lastLaunchedAt;
      if (b.count !== a.count) return b.count - a.count;
    }
    return compareByNameAndPath(a, b);
  });

  return ranked;
}

export function filterApps(apps: readonly RankedApp[], query: string): RankedApp[] {
  if (!query.trim()) return [...apps];
  const scored: Array<{ app: RankedApp; score: number }> = [];
  for (const app of apps) {
    const score = matchAppScore(app, query);
    if (score > 0) {
      scored.push({ app, score });
    }
  }
  scored.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (left.app.recent !== right.app.recent) return left.app.recent ? -1 : 1;
    if (left.app.recent && right.app.recent) {
      if (right.app.lastLaunchedAt !== left.app.lastLaunchedAt) {
        return right.app.lastLaunchedAt - left.app.lastLaunchedAt;
      }
      if (right.app.count !== left.app.count) return right.app.count - left.app.count;
    }
    if (left.app.name.length !== right.app.name.length) {
      return left.app.name.length - right.app.name.length;
    }
    return compareByNameAndPath(left.app, right.app);
  });
  return scored.map((entry) => entry.app);
}
