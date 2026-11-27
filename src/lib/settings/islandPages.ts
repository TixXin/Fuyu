import { readString, removeItem, writeJson } from "../storage.ts";

export const ISLAND_PAGES_KEY = "fuyu-island-pages";
const LAYOUT_VERSION = 1;

export type DockZone = "top" | "left" | "right";
export type EnabledDockSides = { left: boolean; right: boolean };
export type IslandPagesLayout = { order: string[]; hidden: string[]; icons?: Record<string, string>; names?: Record<string, string>; placement?: Record<string, DockZone> };

const ICON_NAME_MAX = 40;
const ICONS_MAX = 64;
export const PAGE_NAME_MAX = 16;
const NAMES_MAX = 64;
const PLACEMENTS_MAX = 64;

export const EMPTY_ISLAND_PAGES: IslandPagesLayout = { order: [], hidden: [] };

const ids = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((id): id is string => typeof id === "string" && id !== "" && !seen.has(id) && Boolean(seen.add(id)));
};

const pageIcons = (value: unknown): Record<string, string> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, string] => entry[0] !== "" && typeof entry[1] === "string" && entry[1] !== "" && entry[1].length <= ICON_NAME_MAX);
  return Object.fromEntries(entries.slice(0, ICONS_MAX));
};

export function cleanPageName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const flat = value.replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim();
  if (flat === "") return null;
  return Array.from(flat).slice(0, PAGE_NAME_MAX).join("").trim();
}

const pageNames = (value: unknown): Record<string, string> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>).flatMap(([id, name]): [string, string][] => {
    const clean = cleanPageName(name);
    return id !== "" && clean !== null ? [[id, clean]] : [];
  });
  return Object.fromEntries(entries.slice(0, NAMES_MAX));
};

const pagePlacements = (value: unknown): Record<string, DockZone> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, DockZone] => entry[0] !== "" && (entry[1] === "left" || entry[1] === "right"));
  return Object.fromEntries(entries.slice(0, PLACEMENTS_MAX));
};

const hasIcons = (layout: IslandPagesLayout) => Object.keys(layout.icons ?? {}).length > 0;
const hasNames = (layout: IslandPagesLayout) => Object.keys(layout.names ?? {}).length > 0;
const hasPlacement = (layout: IslandPagesLayout) => Object.keys(layout.placement ?? {}).length > 0;

const compact = (layout: IslandPagesLayout): IslandPagesLayout => ({
  order: layout.order,
  hidden: layout.hidden,
  ...(hasIcons(layout) ? { icons: layout.icons } : {}),
  ...(hasNames(layout) ? { names: layout.names } : {}),
  ...(hasPlacement(layout) ? { placement: layout.placement } : {}),
});

export function readIslandPages(raw: string | null): IslandPagesLayout {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (typeof value !== "object" || value === null || (value as { version?: unknown }).version !== LAYOUT_VERSION) return EMPTY_ISLAND_PAGES;
    const { order, hidden, icons, names, placement } = value as { order?: unknown; hidden?: unknown; icons?: unknown; names?: unknown; placement?: unknown };
    return compact({ order: ids(order), hidden: ids(hidden), icons: pageIcons(icons), names: pageNames(names), placement: pagePlacements(placement) });
  } catch {
    return EMPTY_ISLAND_PAGES;
  }
}

export function loadIslandPages(): IslandPagesLayout {
  return readIslandPages(readString(ISLAND_PAGES_KEY));
}

export function saveIslandPages(layout: IslandPagesLayout) {
  if (layout.order.length === 0 && layout.hidden.length === 0 && !hasIcons(layout) && !hasNames(layout) && !hasPlacement(layout)) removeItem(ISLAND_PAGES_KEY);
  else writeJson(ISLAND_PAGES_KEY, { version: LAYOUT_VERSION, ...compact(layout) });
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

export function setIslandPageIcon(layout: IslandPagesLayout, id: string, icon: string | null): IslandPagesLayout {
  const rest = Object.entries(layout.icons ?? {}).filter(([page]) => page !== id);
  const next = Object.fromEntries(icon === null ? rest : [...rest, [id, icon]]);
  return compact({ ...layout, icons: next });
}

export function setIslandPageName(layout: IslandPagesLayout, id: string, name: string | null): IslandPagesLayout {
  const clean = cleanPageName(name);
  const rest = Object.entries(layout.names ?? {}).filter(([page]) => page !== id);
  return compact({ ...layout, names: Object.fromEntries(clean === null ? rest : [...rest, [id, clean]]) });
}

export function customPageName(layout: IslandPagesLayout | undefined, id: string): string | undefined {
  const name = layout?.names?.[id];
  return typeof name === "string" && name !== "" ? name : undefined;
}

export function resetIslandPageOrder(layout: IslandPagesLayout): IslandPagesLayout {
  return compact({ order: [], hidden: [], icons: layout.icons, names: layout.names });
}

export function pageDockZone(layout: IslandPagesLayout | undefined, id: string): DockZone {
  const zone = layout?.placement?.[id];
  return zone === "left" || zone === "right" ? zone : "top";
}

export function effectivePageDockZone(layout: IslandPagesLayout | undefined, id: string, enabledSides: EnabledDockSides): DockZone {
  const zone = pageDockZone(layout, id);
  if (zone === "left" && !enabledSides.left) return "top";
  if (zone === "right" && !enabledSides.right) return "top";
  return zone;
}

export function setIslandPagePlacement(layout: IslandPagesLayout, id: string, zone: DockZone): IslandPagesLayout {
  const rest = Object.entries(layout.placement ?? {}).filter(([page]) => page !== id);
  const next = Object.fromEntries(zone === "top" ? rest : [...rest, [id, zone]]);
  return compact({ ...layout, placement: next });
}

export function pagesForDockZone<Item extends { id: string }>(
  items: readonly Item[],
  layout: IslandPagesLayout | undefined,
  zone: DockZone,
  enabledSides: EnabledDockSides,
): Item[] {
  return orderIslandPages(items, layout).filter((item) => effectivePageDockZone(layout, item.id, enabledSides) === zone);
}
