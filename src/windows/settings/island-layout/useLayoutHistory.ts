import { useCallback, useEffect, useRef, useState } from "react";
import type { CollapsedPlacement } from "../../../lib/settings/collapsedItems";
import { sameLayout } from "./laneMoves";

const UNDO_STEPS = 20;
const NOTICE_MS = 5_000;

export type LayoutNotice = { text: string; undo: boolean; key: number };

function editable(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || Boolean(target.closest("input, textarea, select")));
}

export function useLayoutHistory(save: (next: CollapsedPlacement[]) => void, undoneText: string) {
  const [past, setPast] = useState<CollapsedPlacement[][]>([]);
  const [notice, setNotice] = useState<LayoutNotice | null>(null);
  const [said, setSaid] = useState("");
  const pastRef = useRef(past);
  useEffect(() => {
    pastRef.current = past;
  }, [past]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const say = useCallback((text: string) => setSaid(text), []);

  const record = useCallback((before: CollapsedPlacement[], next: CollapsedPlacement[], text: string) => {
    if (sameLayout(before, next)) return false;
    setPast((list) => [...list, before].slice(-UNDO_STEPS));
    save(next);
    setNotice({ text, undo: true, key: Date.now() });
    setSaid(text);
    return true;
  }, [save]);

  const undo = useCallback(() => {
    const previous = pastRef.current[pastRef.current.length - 1];
    if (!previous) return;
    setPast((list) => list.slice(0, -1));
    save(previous);
    setNotice({ text: undoneText, undo: false, key: Date.now() });
    setSaid(undoneText);
  }, [save, undoneText]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== "z" || editable(event.target)) return;
      if (pastRef.current.length === 0) return;
      event.preventDefault();
      undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  return { record, undo, canUndo: past.length > 0, notice, dismiss: () => setNotice(null), said, say };
}
