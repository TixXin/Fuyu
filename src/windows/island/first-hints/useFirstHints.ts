import { useCallback, useEffect, useState } from "react";
import { isRetired, markFirstHintDismissed, markFirstHintShown, nextFirstHint, type FirstHintId } from "./hints.ts";
import { loadFirstHints, saveFirstHints } from "./storage.ts";

const SHOW_MS = 8000;

export type FirstHintTriggers = { agent: boolean; message: boolean; tuck: boolean };

export function useFirstHints({ agent, message, tuck }: FirstHintTriggers, { canShow, paused }: { canShow: boolean; paused: boolean }) {
  const [pending, setPending] = useState<FirstHintId[]>([]);
  const [current, setCurrent] = useState<FirstHintId | null>(null);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (paused) return;
    const fired: FirstHintId[] = [...(agent ? ["agent" as const] : []), ...(message ? ["message" as const] : []), ...(tuck ? ["tuck" as const] : [])];
    if (fired.length === 0) return;
    setPending((list) => {
      const added = fired.filter((id) => !list.includes(id));
      return added.length === 0 ? list : [...list, ...added];
    });
  }, [agent, message, tuck, paused]);

  useEffect(() => {
    if (current || !canShow || paused || pending.length === 0) return;
    const now = Date.now();
    const state = loadFirstHints();
    const id = nextFirstHint(state, pending, now);
    setPending((list) => {
      const kept = list.filter((item) => item !== id && !isRetired(state, item));
      return kept.length === list.length ? list : kept;
    });
    if (!id) return;
    saveFirstHints(markFirstHintShown(state, id, now));
    setHeld(false);
    setCurrent(id);
  }, [canShow, current, paused, pending]);

  useEffect(() => {
    if (current && (!canShow || paused)) setCurrent(null);
  }, [canShow, current, paused]);

  useEffect(() => {
    if (!current || held) return;
    const timer = window.setTimeout(() => setCurrent(null), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [current, held]);

  const dismiss = useCallback(() => {
    if (!current) return;
    saveFirstHints(markFirstHintDismissed(loadFirstHints(), current));
    setCurrent(null);
  }, [current]);

  const hold = useCallback(() => setHeld(true), []);
  const release = useCallback(() => setHeld(false), []);

  return { current, dismiss, hold, release };
}

export type FirstHintsController = ReturnType<typeof useFirstHints>;
