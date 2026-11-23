export const QUICK_TARGETS = ["terminal", "files", "calculator", "settings"] as const;
export const MAX_LAUNCHER_ITEMS = 16;
const MAX_PATH = 1024;
const MAX_NAME = 80;

export type QuickTarget = (typeof QUICK_TARGETS)[number];
export type LauncherItem = { builtin: QuickTarget } | { path: string; name: string };

export const DEFAULT_LAUNCHER: readonly LauncherItem[] = QUICK_TARGETS.map((builtin) => ({ builtin }));

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isTarget = (value: unknown): value is QuickTarget => QUICK_TARGETS.some((target) => target === value);

export const launcherKey = (item: LauncherItem) => ("builtin" in item ? `builtin:${item.builtin}` : `path:${item.path.toLowerCase()}`);

function item(value: unknown): LauncherItem | null {
  if (!isRecord(value)) return null;
  if (isTarget(value.builtin)) return { builtin: value.builtin };
  if (typeof value.path !== "string" || !value.path.trim() || value.path.length > MAX_PATH) return null;
  const name = typeof value.name === "string" ? value.name.trim().slice(0, MAX_NAME) : "";
  return { path: value.path, name };
}

export function normalizeLauncher(raw: unknown): LauncherItem[] {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.items)) return [...DEFAULT_LAUNCHER];
  const seen = new Set<string>();
  const items: LauncherItem[] = [];
  for (const value of raw.items) {
    const next = item(value);
    if (!next || seen.has(launcherKey(next)) || items.length >= MAX_LAUNCHER_ITEMS) continue;
    seen.add(launcherKey(next));
    items.push(next);
  }
  return items;
}

export function serializeLauncher(items: readonly LauncherItem[]) {
  return { version: 1, items: normalizeLauncher({ version: 1, items }) };
}

export function withApp(items: readonly LauncherItem[], path: string, name: string): LauncherItem[] {
  const added: LauncherItem = { path, name };
  if (items.some((existing) => launcherKey(existing) === launcherKey(added)) || items.length >= MAX_LAUNCHER_ITEMS) return [...items];
  return [...items, added];
}

export function moveItem(items: readonly LauncherItem[], from: number, to: number): LauncherItem[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export const hiddenBuiltins = (items: readonly LauncherItem[]): QuickTarget[] => QUICK_TARGETS.filter((target) => !items.some((existing) => "builtin" in existing && existing.builtin === target));

const TILE_SIZES = [40, 34, 28] as const;

export function launcherGrid(count: number, width: number, height: number) {
  let fallback = { tile: 28, gap: 6, columns: 1, capacity: 1 };
  for (const tile of TILE_SIZES) {
    const gap = tile >= 40 ? 8 : 6;
    const columns = Math.max(1, Math.floor((width + gap) / (tile + gap)));
    const rows = Math.max(1, Math.floor((height + gap) / (tile + gap)));
    fallback = { tile, gap, columns, capacity: columns * rows };
    if (fallback.capacity >= count) return { ...fallback, columns: Math.min(columns, Math.max(1, count)) };
  }
  return fallback;
}
