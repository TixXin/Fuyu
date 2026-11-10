import { useCallback, useEffect, useRef, useState } from "react";
import type { ClipboardHistoryItem } from "./api";

/** How long a deleted entry can be brought back. */
const UNDO_MS = 6_000;

/**
 * Deleting with undo (C38): the entry is hidden at once and deleted for good only after UNDO_MS,
 * when another one is deleted, or on `flush` (the window opening again), so Ctrl+Z can bring it
 * back with its image. `commit` does the real deletion.
 */
export function usePendingDelete(commit: (id: string) => void) {
  const [pending, setPending] = useState<ClipboardHistoryItem | null>(null);
  const pendingRef = useRef<ClipboardHistoryItem | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const commitRef = useRef(commit);
  commitRef.current = commit;

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    const item = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    if (item) commitRef.current(item.id);
  }, []);

  const remove = useCallback((item: ClipboardHistoryItem) => {
    flush();
    pendingRef.current = item;
    setPending(item);
    timer.current = window.setTimeout(flush, UNDO_MS);
  }, [flush]);

  const undo = useCallback(() => {
    window.clearTimeout(timer.current);
    pendingRef.current = null;
    setPending(null);
  }, []);

  useEffect(() => flush, [flush]);
  return { pending, remove, undo, flush };
}
