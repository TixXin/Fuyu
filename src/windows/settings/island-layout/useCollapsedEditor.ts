import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "../../../i18n";
import type { CollapsedPlacement } from "../../../lib/settings/collapsedItems";
import { laneIds, laneOf, placeItem, restoreItem, stepItem, type LaneId, type StepKey } from "./laneMoves";
import { useLaneDrag } from "./useLaneDrag";
import { useLayoutHistory } from "./useLayoutHistory";
import type { CollapsedLayout } from "./useCollapsedLayout";

export type CollapsedEditor = ReturnType<typeof useCollapsedEditor>;

export function useCollapsedEditor(layout: CollapsedLayout) {
  const text = useTranslation().settings.collapsedItems.lanes;
  const { names, placements, save } = layout;
  const listed = useMemo(() => new Set(layout.listed), [layout.listed]);
  const [draft, setDraft] = useState<CollapsedPlacement[] | null>(null);
  const [picked, setPicked] = useState<{ id: string; snapshot: CollapsedPlacement[] } | null>(null);
  const focusId = useRef<string | null>(null);
  const history = useLayoutHistory(save, text.undone);
  const { record, say } = history;
  const view = draft ?? placements;

  const name = useCallback((id: string) => names.get(id) ?? id, [names]);
  const where = useCallback((list: readonly CollapsedPlacement[], id: string) => {
    const item = list.find((placement) => placement.id === id);
    if (!item) return "";
    const lane = laneOf(item);
    return text.at(text.name[lane], laneIds(list, lane, listed).indexOf(id) + 1);
  }, [listed, text]);
  const describe = useCallback((list: readonly CollapsedPlacement[], id: string) => {
    const item = list.find((placement) => placement.id === id);
    return item?.hidden ? text.removed(name(id)) : text.placed(name(id), where(list, id));
  }, [name, text, where]);

  const commit = useCallback((before: CollapsedPlacement[], next: CollapsedPlacement[], id: string) => {
    if (!record(before, next, describe(next, id))) say(text.unmoved);
  }, [describe, record, say, text.unmoved]);

  const cancelled = useCallback(() => say(text.cancelled), [say, text.cancelled]);
  const { drag, start } = useLaneDrag({ placements, listed, onDraft: setDraft, onDrop: commit, onCancel: cancelled });

  const move = (id: string, lane: LaneId) => {
    focusId.current = id;
    commit(placements, placeItem(placements, id, lane, null, listed), id);
  };
  const restore = (id: string) => {
    focusId.current = id;
    const next = restoreItem(placements, id);
    const item = next.find((placement) => placement.id === id);
    record(placements, next, text.restored(name(id), text.name[item ? laneOf(item) : "right"]));
  };
  const reset = () => {
    record(placements, [], text.resetDone);
  };

  const drop = () => {
    if (!picked) return;
    const next = draft ?? placements;
    setPicked(null);
    setDraft(null);
    commit(picked.snapshot, next, picked.id);
  };
  const pickUp = (id: string) => {
    focusId.current = id;
    if (picked?.id === id) return drop();
    if (picked) drop();
    setPicked({ id, snapshot: placements });
    say(text.picked(name(id), where(placements, id)));
  };
  const cancelPick = () => {
    if (!picked) return false;
    focusId.current = picked.id;
    setPicked(null);
    setDraft(null);
    say(text.cancelled);
    return true;
  };
  const step = (id: string, key: StepKey, direct: boolean) => {
    focusId.current = id;
    if (direct) {
      const next = stepItem(placements, id, key, listed);
      if (next) commit(placements, next, id);
      return;
    }
    if (picked?.id !== id) return;
    const next = stepItem(view, id, key, listed);
    if (!next) return;
    setDraft(next);
    say(where(next, id));
  };

  const takeFocus = () => {
    const id = focusId.current;
    focusId.current = null;
    return id;
  };

  return {
    view,
    takeFocus,
    listed,
    drag,
    picked: picked?.id ?? null,
    startDrag: start,
    move,
    restore,
    reset,
    pickUp,
    drop,
    cancelPick,
    step,
    history,
  };
}
