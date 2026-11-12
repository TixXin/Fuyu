import { pathKey } from "./fileShelf.ts";

export type SelectMode = "single" | "toggle" | "range";

export type ShelfSelection = {
  ids: string[];
  anchor: string | null;
};

export const EMPTY_SELECTION: ShelfSelection = { ids: [], anchor: null };

export function selectEntry(
  selection: ShelfSelection,
  visibleIds: string[],
  id: string,
  mode: SelectMode,
): ShelfSelection {
  if (mode === "range" && selection.anchor && visibleIds.includes(selection.anchor)) {
    const from = visibleIds.indexOf(selection.anchor);
    const to = visibleIds.indexOf(id);
    const [start, end] = from <= to ? [from, to] : [to, from];
    return { ids: visibleIds.slice(start, end + 1), anchor: selection.anchor };
  }
  if (mode === "toggle") {
    const chosen = new Set(selection.ids);
    if (chosen.has(id)) chosen.delete(id);
    else chosen.add(id);
    return { ids: visibleIds.filter((visible) => chosen.has(visible)), anchor: id };
  }
  return { ids: [id], anchor: id };
}

export function keepVisible(selection: ShelfSelection, visibleIds: string[]): ShelfSelection {
  const ids = selection.ids.filter((id) => visibleIds.includes(id));
  const anchor = selection.anchor && visibleIds.includes(selection.anchor) ? selection.anchor : null;
  return ids.length === selection.ids.length && anchor === selection.anchor ? selection : { ids, anchor };
}

export function targetIds(selection: ShelfSelection, id: string) {
  return selection.ids.includes(id) ? selection.ids : [id];
}

export function filterShelfItems<T extends { name: string; path: string }>(items: T[], query: string) {
  const needle = pathKey(query.trim());
  if (!needle) return items;
  return items.filter((item) => pathKey(item.name).includes(needle) || pathKey(item.path).includes(needle));
}
