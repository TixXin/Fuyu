export type ManageSelection = { ids: ReadonlySet<string>; anchor: string | null };

export const EMPTY_SELECTION: ManageSelection = { ids: new Set(), anchor: null };

export function rangeIds(order: readonly string[], from: string, to: string): string[] {
  const start = order.indexOf(from);
  const end = order.indexOf(to);
  if (start < 0 || end < 0) return end < 0 ? [] : [to];
  return order.slice(Math.min(start, end), Math.max(start, end) + 1);
}

export function clickSelection(
  selection: ManageSelection,
  order: readonly string[],
  id: string,
  { shift = false, toggle = false }: { shift?: boolean; toggle?: boolean },
): ManageSelection {
  const anchor = selection.anchor !== null && order.includes(selection.anchor) ? selection.anchor : null;
  if (shift && anchor !== null) {
    const range = rangeIds(order, anchor, id);
    return { ids: new Set(toggle ? [...selection.ids, ...range] : range), anchor };
  }
  if (toggle) {
    const ids = new Set(selection.ids);
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    return { ids, anchor: id };
  }
  return { ids: new Set([id]), anchor: id };
}

export function selectAll(order: readonly string[]): ManageSelection {
  return { ids: new Set(order), anchor: order[0] ?? null };
}

export function visibleSelection(selection: ManageSelection, order: readonly string[]): string[] {
  if (selection.ids.size === 0) return [];
  return order.filter((id) => selection.ids.has(id));
}
