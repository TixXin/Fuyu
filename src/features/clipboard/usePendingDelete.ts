import { useCallback, useEffect, useRef, useState } from "react";
import type { ClipboardHistoryItem } from "./api";

const UNDO_MS = 6_000;

type Pending = readonly ClipboardHistoryItem[];

export function usePendingDelete(commit: (ids: string[]) => void, restore: (ids: string[]) => void) {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const actions = useRef({ commit, restore });
  actions.current = { commit, restore };

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    pendingRef.current = null;
    setPending(null);
  }, []);

  const removeMany = useCallback((items: Pending) => {
    if (items.length === 0) return;
    flush();
    pendingRef.current = items;
    setPending(items);
    actions.current.commit(items.map((item) => item.id));
    timer.current = window.setTimeout(flush, UNDO_MS);
  }, [flush]);

  const remove = useCallback((item: ClipboardHistoryItem) => removeMany([item]), [removeMany]);

  const undo = useCallback(() => {
    const items = pendingRef.current;
    flush();
    if (items) actions.current.restore(items.map((item) => item.id));
  }, [flush]);

  useEffect(() => flush, [flush]);
  return { pending, remove, removeMany, undo, flush };
}
