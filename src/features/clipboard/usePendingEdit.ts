import { useCallback, useEffect, useRef, useState } from "react";
import { editClipboardHistoryText, undoClipboardHistoryEdit } from "./api";

const UNDO_MS = 6_000;

export function usePendingEdit(attempt: (action: string, promise: Promise<unknown>) => void) {
  const [pending, setPending] = useState<string | null>(null);
  const pendingRef = useRef<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    pendingRef.current = null;
    setPending(null);
  }, []);

  const mark = useCallback((id: string) => {
    window.clearTimeout(timer.current);
    pendingRef.current = id;
    setPending(id);
    timer.current = window.setTimeout(flush, UNDO_MS);
  }, [flush]);

  const save = useCallback((id: string, text: string) => {
    attempt("update a clipboard entry", editClipboardHistoryText(id, text).then(() => mark(id)));
  }, [attempt, mark]);

  const undo = useCallback(() => {
    const id = pendingRef.current;
    flush();
    if (id) attempt("undo an edit", undoClipboardHistoryEdit(id));
  }, [attempt, flush]);

  useEffect(() => flush, [flush]);
  return { pending, mark, save, undo };
}
