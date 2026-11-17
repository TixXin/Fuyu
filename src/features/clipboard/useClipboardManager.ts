import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { deleteClipboardItems, restoreClipboardItems, type ClipboardHistoryItem } from "./api";
import { clickSelection, EMPTY_SELECTION, selectAll, visibleSelection, type ManageSelection } from "./manageSelection";
import { withoutPending } from "./pendingItems";
import { filterPopupItems, popupFilters, popupTags, type PopupFilter } from "./popupFilters";
import { loadPinyin, parsePopupQuery } from "./popupQuery";
import { usePendingDelete } from "./usePendingDelete";

const CLOCK_MS = 30_000;

type Click = { shift?: boolean; toggle?: boolean };

export function useClipboardManager(items: readonly ClipboardHistoryItem[]) {
  const [filter, setFilter] = useState<PopupFilter>("all");
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<ManageSelection>(EMPTY_SELECTION);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [pinyinReady, setPinyinReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const searched = useDeferredValue(query);

  useEffect(() => {
    void loadPinyin().then((pinyin) => setPinyinReady(pinyin !== null));
    return visibilityInterval(() => setNow(Date.now()), CLOCK_MS);
  }, []);

  const report = useCallback((action: string) => (error: unknown) => {
    console.error(`Failed to ${action}`, error);
    setFailed(true);
  }, []);
  const deletion = usePendingDelete(
    (ids) => void deleteClipboardItems(ids).catch(report("delete clipboard entries")),
    (ids) => void restoreClipboardItems(ids).catch(report("restore clipboard entries")),
  );

  const visible = useMemo(() => withoutPending(items, deletion.pending), [items, deletion.pending]);
  const filters = useMemo(() => popupFilters(popupTags(visible)).filter((chip) => chip !== "snippets"), [visible]);
  const parsed = useMemo(() => parsePopupQuery(searched), [searched]);
  const shown = useMemo(
    () => filterPopupItems(visible, filter, parsed, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, filter, parsed, now, pinyinReady],
  );
  const order = useMemo(() => shown.map((item) => item.id), [shown]);
  const picked = useMemo(() => visibleSelection(selection, order), [selection, order]);
  const focusAt = focusId === null ? -1 : order.indexOf(focusId);
  const focusIndex = focusAt >= 0 ? focusAt : shown.length > 0 ? 0 : -1;
  const focused = focusIndex >= 0 ? shown[focusIndex] : undefined;

  const click = useCallback((index: number, how: Click) => {
    const id = order[index];
    if (id === undefined) return;
    setSelection((current) => clickSelection(current, order, id, how));
    setFocusId(id);
  }, [order]);

  const move = useCallback((index: number, extend: boolean) => {
    const target = Math.max(0, Math.min(order.length - 1, index));
    const id = order[target];
    if (id === undefined) return;
    if (extend) {
      const from = focused?.id ?? id;
      setSelection((current) => clickSelection(current.anchor !== null && order.includes(current.anchor) ? current : { ids: current.ids, anchor: from }, order, id, { shift: true }));
    }
    setFocusId(id);
  }, [order, focused]);

  const chooseFilter = useCallback((next: PopupFilter) => {
    setFilter(next);
    setFocusId(null);
  }, []);

  const search = useCallback((value: string) => {
    setQuery(value);
    setFocusId(null);
  }, []);

  const removePicked = useCallback(() => {
    const ids = new Set(picked.length > 0 ? picked : focused ? [focused.id] : []);
    if (ids.size === 0) return;
    setFailed(false);
    deletion.removeMany(shown.filter((item) => ids.has(item.id)));
    setSelection(EMPTY_SELECTION);
    const next = shown.find((item, index) => index > focusIndex && !ids.has(item.id)) ?? [...shown].reverse().find((item) => !ids.has(item.id));
    setFocusId(next?.id ?? null);
  }, [picked, focused, deletion, shown, focusIndex]);

  const pickedFavorites = useMemo(() => {
    const ids = new Set(picked);
    return shown.filter((item) => item.favorite && ids.has(item.id)).length;
  }, [picked, shown]);

  return {
    filter, filters, chooseFilter, query, search, now, shown, picked, pickedFavorites, focusIndex, focused, failed, deletion,
    click, move, removePicked,
    selectAll: () => setSelection(selectAll(order)),
    selectNone: () => setSelection(EMPTY_SELECTION),
  };
}
