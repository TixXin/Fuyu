import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useErrorText } from "../../i18n";
import {
  addFileShelfPaths,
  clearFileShelf,
  copyFileShelfItems,
  getFileShelf,
  listenFileShelfChanged,
  openFileShelfItem,
  removeFileShelfItems,
  revealFileShelfItem,
  setFileShelfOptions,
  startFileShelfDrag,
  toggleFileShelfPin,
  type FileShelfItem,
  type FileShelfOptions,
  type FileShelfSnapshot,
} from "./api";
import { getDropResult } from "./fileShelf";

const RECENT_DROP_MS = 1_200;

export type FileShelfController = ReturnType<typeof useFileShelf>;

export type FileShelfDrop = { key: number; ids: string[]; allExisting: boolean };

export type FileShelfPreferences = FileShelfOptions & { removeAfterDragOut: boolean };

export function useFileShelf(
  enabled: boolean,
  { maxItems, maxAgeDays, removeMissing, removeAfterDragOut }: FileShelfPreferences,
) {
  const errorText = useErrorText();
  const [items, setItems] = useState<FileShelfItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [recentDrop, setRecentDrop] = useState<FileShelfDrop | null>(null);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const draggingOutRef = useRef(false);

  const run = useCallback(async (action: () => Promise<FileShelfSnapshot | void>) => {
    try {
      const snapshot = await action();
      if (snapshot) setItems(snapshot.items);
      setError(null);
      return snapshot;
    } catch (caught) {
      setError(errorText(caught));
      return null;
    }
  }, [errorText]);

  const refresh = useCallback(() => run(getFileShelf), [run]);

  useEffect(() => {
    if (enabled) void run(() => setFileShelfOptions({ maxItems, maxAgeDays, removeMissing }));
  }, [enabled, maxAgeDays, maxItems, removeMissing, run]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void listenFileShelfChanged(() => void refresh())
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch((caught: unknown) => console.error("Failed to listen for file shelf changes", caught));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [enabled, refresh]);

  useEffect(() => {
    if (!recentDrop) return;
    const timer = window.setTimeout(() => setRecentDrop(null), RECENT_DROP_MS);
    return () => window.clearTimeout(timer);
  }, [recentDrop]);

  const addPaths = useCallback(async (paths: string[]) => {
    if (draggingOutRef.current || paths.length === 0) return;
    const before = itemsRef.current;
    const snapshot = await run(() => addFileShelfPaths(paths));
    if (!snapshot) return;
    const result = getDropResult(paths, before, snapshot.items);
    if (result.ids.length > 0) setRecentDrop({ key: Date.now(), ...result });
  }, [run]);

  const startDrag = useCallback(async (ids: string[]) => {
    if (draggingOutRef.current) return;
    draggingOutRef.current = true;
    try {
      await run(() => startFileShelfDrag(ids, removeAfterDragOut));
    } finally {
      draggingOutRef.current = false;
    }
  }, [removeAfterDragOut, run]);

  const isDraggingOut = useCallback(() => draggingOutRef.current, []);

  return useMemo(() => ({
    items,
    error,
    recentDrop,
    refresh,
    addPaths,
    startDrag,
    isDraggingOut,
    remove: (ids: string[]) => run(() => removeFileShelfItems(ids)),
    togglePin: (id: string) => run(() => toggleFileShelfPin(id)),
    clear: () => run(clearFileShelf),
    copy: async (ids: string[]) => (await run(() => copyFileShelfItems(ids))) !== null,
    open: (id: string) => run(() => openFileShelfItem(id)),
    reveal: (id: string) => run(() => revealFileShelfItem(id)),
  }), [addPaths, error, isDraggingOut, items, recentDrop, refresh, run, startDrag]);
}
