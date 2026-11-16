export type CollapsedZone = "left" | "right";
export type CollapsedPlacement = { id: string; zone: CollapsedZone; hidden?: boolean };

export const COLLAPSED_ITEMS_KEY = "fuyu-collapsed-items";
const LAYOUT_VERSION = 1;

const DEFAULT_ORDER: readonly { id: string; zone: CollapsedZone }[] = [
  { id: "status-light", zone: "left" },
  { id: "mail", zone: "right" },
  { id: "update", zone: "right" },
  { id: "plugin:", zone: "right" },
  { id: "device-use", zone: "right" },
  { id: "shelf", zone: "right" },
  { id: "music", zone: "right" },
  { id: "usage:", zone: "right" },
  { id: "session-count", zone: "right" },
];

function defaultSlot(id: string) {
  const index = DEFAULT_ORDER.findIndex((entry) => (entry.id.endsWith(":") ? id.startsWith(entry.id) : entry.id === id));
  return index < 0 ? { rank: DEFAULT_ORDER.length, zone: "right" as const } : { rank: index, zone: DEFAULT_ORDER[index].zone };
}

const isPlacement = (value: unknown): value is CollapsedPlacement =>
  typeof value === "object" && value !== null
  && typeof (value as CollapsedPlacement).id === "string"
  && ((value as CollapsedPlacement).zone === "left" || (value as CollapsedPlacement).zone === "right");

export function loadCollapsedPlacements(): CollapsedPlacement[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(COLLAPSED_ITEMS_KEY) ?? "null");
    if (typeof value !== "object" || value === null || (value as { version?: unknown }).version !== LAYOUT_VERSION) return [];
    const items = (value as { items?: unknown }).items;
    if (!Array.isArray(items)) return [];
    const seen = new Set<string>();
    return items.filter(isPlacement).filter(({ id }) => !seen.has(id) && Boolean(seen.add(id)))
      .map(({ id, zone, hidden }) => (hidden ? { id, zone, hidden: true } : { id, zone }));
  } catch {
    return [];
  }
}

export function saveCollapsedPlacements(placements: readonly CollapsedPlacement[]) {
  if (placements.length === 0) localStorage.removeItem(COLLAPSED_ITEMS_KEY);
  else localStorage.setItem(COLLAPSED_ITEMS_KEY, JSON.stringify({ version: LAYOUT_VERSION, items: placements }));
}

export function arrangeCollapsedItems(offered: readonly string[], saved: readonly CollapsedPlacement[]): CollapsedPlacement[] {
  const result = [...saved];
  const known = new Set(saved.map(({ id }) => id));
  for (const id of offered) {
    if (known.has(id)) continue;
    known.add(id);
    const { rank, zone } = defaultSlot(id);
    let after = -1;
    let afterRank = -1;
    result.forEach((placement, index) => {
      const other = defaultSlot(placement.id).rank;
      if (placement.zone === zone && other <= rank && other >= afterRank) [after, afterRank] = [index, other];
    });
    const firstOfZone = result.findIndex((placement) => placement.zone === zone);
    const at = after >= 0 ? after + 1 : firstOfZone >= 0 ? firstOfZone : zone === "left" ? 0 : result.length;
    result.splice(at, 0, { id, zone });
  }
  return result;
}

export function zoneIds(placements: readonly CollapsedPlacement[], zone: CollapsedZone, offered: readonly string[]) {
  const present = new Set(offered);
  return placements.filter((placement) => placement.zone === zone && !placement.hidden && present.has(placement.id)).map(({ id }) => id);
}

export function isCollapsedItemHidden(placements: readonly CollapsedPlacement[], id: string) {
  return placements.some((placement) => placement.id === id && placement.hidden);
}

export function moveCollapsedItem(placements: readonly CollapsedPlacement[], id: string, step: -1 | 1, listed: readonly string[]) {
  const index = placements.findIndex((placement) => placement.id === id);
  if (index < 0) return [...placements];
  const shown = new Set(listed);
  const zone = placements[index].zone;
  let target = index + step;
  while (target >= 0 && target < placements.length && (placements[target].zone !== zone || !shown.has(placements[target].id))) target += step;
  if (target < 0 || target >= placements.length) return [...placements];
  const next = [...placements];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function setCollapsedItemZone(placements: readonly CollapsedPlacement[], id: string, zone: CollapsedZone) {
  const item = placements.find((placement) => placement.id === id);
  if (!item || item.zone === zone) return [...placements];
  const rest = placements.filter((placement) => placement.id !== id);
  const lastOfZone = rest.map((placement) => placement.zone).lastIndexOf(zone);
  const at = lastOfZone >= 0 ? lastOfZone + 1 : zone === "left" ? 0 : rest.length;
  rest.splice(at, 0, { ...item, zone });
  return rest;
}

export function setCollapsedItemHidden(placements: readonly CollapsedPlacement[], id: string, hidden: boolean) {
  return placements.map((placement) => (placement.id !== id ? placement : hidden ? { ...placement, hidden: true } : { id: placement.id, zone: placement.zone }));
}
