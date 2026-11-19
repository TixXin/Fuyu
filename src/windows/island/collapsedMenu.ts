import { barItemName } from "../../features/plugin-kernel/barUsage.ts";
import { arrangeCollapsedItems, setCollapsedItemHidden, type CollapsedPlacement } from "../../lib/settings/collapsedItems.ts";

export type CollapsedMenuEntry = { id: string; owner: string; external: boolean; group?: string; hideable?: boolean };
export type CollapsedMenuRow = { id: string; name: string; shown: boolean };

const listed = (entry: CollapsedMenuEntry) => entry.group !== "gauges" || entry.hideable === true;

export function collapsedMenuIds(entries: readonly CollapsedMenuEntry[]): string[] {
  const seen = new Set<string>();
  return entries.filter(listed).map(({ id }) => id).filter((id) => !seen.has(id) && Boolean(seen.add(id)));
}

export function collapsedMenuRows(entries: readonly CollapsedMenuEntry[], saved: readonly CollapsedPlacement[], nameOf: (entry: CollapsedMenuEntry) => string): CollapsedMenuRow[] {
  const byId = new Map(entries.filter(listed).map((entry) => [entry.id, entry]));
  return arrangeCollapsedItems(collapsedMenuIds(entries), saved).flatMap((placement) => {
    const entry = byId.get(placement.id);
    return entry ? [{ id: entry.id, name: nameOf(entry), shown: !placement.hidden }] : [];
  });
}

export function toggleCollapsedMenuItem(entries: readonly CollapsedMenuEntry[], saved: readonly CollapsedPlacement[], id: string): CollapsedPlacement[] {
  const placements = arrangeCollapsedItems(collapsedMenuIds(entries), saved);
  const current = placements.find((placement) => placement.id === id);
  return current ? setCollapsedItemHidden(placements, id, !current.hidden) : placements;
}

export type CollapsedNameSources = {
  labels: ReadonlyMap<string, string>;
  builtin: Readonly<Record<string, string>>;
  plugins: ReadonlyMap<string, string>;
};

export function collapsedItemName(entry: CollapsedMenuEntry, entries: readonly CollapsedMenuEntry[], { labels, builtin, plugins }: CollapsedNameSources): string {
  const label = labels.get(entry.id);
  if (label) return label;
  if (!entry.external) return builtin[entry.id] ?? entry.id;
  const siblings = collapsedMenuIds(entries.filter((other) => other.external && other.owner === entry.owner));
  return barItemName(entry, siblings.length, null, plugins.get(entry.owner));
}
