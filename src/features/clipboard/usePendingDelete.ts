import { useCallback, useEffect, useRef, useState } from "react";
import type { ClipboardHistoryItem } from "./api";

const UNDO_MS = 6_000;

export function usePendingDelete(commit: (id: string) => void, restore: (id: string) => void) {
  const [pending, setPending] = useState<ClipboardHistoryItem | null>(null);
  const pendingRef = useRef<ClipboardHistoryItem | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const actions = useRef({ commit, restore });
  actions.current = { commit, restore };

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    pendingRef.current = null;
    setPending(null);
  }, []);

  const remove = useCallback((item: ClipboardHistoryItem) => {
    flush();
    pendingRef.current = item;
    setPending(item);
    actions.current.commit(item.id);
    timer.current = window.setTimeout(flush, UNDO_MS);
  }, [flush]);

  const undo = useCallback(() => {
    const item = pendingRef.current;
    flush();
    if (item) actions.current.restore(item.id);
  }, [flush]);

  useEffect(() => flush, [flush]);
  return { pending, remove, undo, flush };
}
