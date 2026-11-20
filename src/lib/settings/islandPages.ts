import { readString, removeItem, writeJson } from "../storage.ts";

export const ISLAND_PAGES_KEY = "fuyu-island-pages";
const LAYOUT_VERSION = 1;

export type IslandPagesLayout = { order: string[]; hidden: string[] };

export const EMPTY_ISLAND_PAGES: IslandPagesLayout = { order: [], hidden: [] };

const ids = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((id): id is string => typeof id === "string" && id !== "" && !seen.has(id) && Boolean(seen.add(id)));
};

export function readIslandPages(raw: string | null): IslandPagesLayout {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (typeof value !== "object" || value === null || (value as { version?: unknown }).version !== LAYOUT_VERSION) return EMPTY_ISLAND_PAGES;
    const { order, hidden } = value as { order?: unknown; hidden?: unknown };
    return { order: ids(order), hidden: ids(hidden) };
  } catch {
    return EMPTY_ISLAND_PAGES;
  }
}

export function loadIslandPages(): IslandPagesLayout {
  return readIslandPages(readString(ISLAND_PAGES_KEY));
}

export function saveIslandPages(layout: IslandPagesLayout) {
  if (layout.order.length === 0 && layout.hidden.length === 0) removeItem(ISLAND_PAGES_KEY);
  else writeJson(ISLAND_PAGES_KEY, { version: LAYOUT_VERSION, order: layout.order, hidden: layout.hidden });
}

export function arrangeIslandPages(defaults: readonly string[], saved: readonly string[]): string[] {
  const result = [...saved];
  const known = new Set(saved);
  defaults.forEach((id, index) => {
    if (known.has(id)) return;
    known.add(id);
    let at = 0;
    for (let before = index - 1; before >= 0; before -= 1) {
      const found = result.indexOf(defaults[before]);
      if (found >= 0) {
        at = found + 1;
        break;
      }
    }
    result.splice(at, 0, id);
  });
  return result;
}

export function orderIslandPages<Item extends { id: string }>(items: readonly Item[], layout: IslandPagesLayout | undefined): Item[] {
  if (!layout || (layout.order.length === 0 && layout.hidden.length === 0)) return [...items];
  const hidden = new Set(layout.hidden);
  const order = arrangeIslandPages(items.map((item) => item.id), layout.order);
  const rank = new Map(order.map((id, index) => [id, index]));
  return items.filter((item) => !hidden.has(item.id)).sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}

export function moveIslandPage(layout: IslandPagesLayout, listed: readonly string[], id: string, step: -1 | 1): IslandPagesLayout {
  const order = arrangeIslandPages(listed, layout.order);
  const shown = new Set(listed);
  const index = order.indexOf(id);
  if (index < 0) return layout;
  let target = index + step;
  while (target >= 0 && target < order.length && !shown.has(order[target])) target += step;
  if (target < 0 || target >= order.length) return layout;
  [order[index], order[target]] = [order[target], order[index]];
  return { ...layout, order };
}

export function setIslandPageHidden(layout: IslandPagesLayout, id: string, hidden: boolean): IslandPagesLayout {
  const rest = layout.hidden.filter((other) => other !== id);
  return { ...layout, hidden: hidden ? [...rest, id] : rest };
}

export function placeIslandPage(layout: IslandPagesLayout, listed: readonly string[], id: string, before: string | null): IslandPagesLayout {
  const order = arrangeIslandPages(listed, layout.order);
  if (!order.includes(id) || before === id) return layout;
  const rest = order.filter((other) => other !== id);
  const at = before === null ? rest.length : rest.indexOf(before);
  if (at < 0) return layout;
  rest.splice(at, 0, id);
  return { ...layout, order: rest };
}
