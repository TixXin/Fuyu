import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { IslandLineContribution } from "../../features/plugin-kernel/islandContributions";
import { useNotchTextModes } from "../../lib/settings/collapsedText";
import { advanceFlash, changedTexts, flashLive, NOTCH_FLASH_MS, pruneFlash, queueFlash, routeNotchText, type FlashEntry, type NotchTextRoute } from "./notchText";

const NONE: NotchTextRoute = { row: null, panel: [] };
const EMPTY: readonly FlashEntry[] = [];

export function useNotchText(active: boolean, lines: readonly IslandLineContribution[]): NotchTextRoute {
  const modes = useNotchTextModes();
  const seen = useRef<ReadonlyMap<string, string> | null>(null);
  const [queue, setQueue] = useState<readonly FlashEntry[]>(EMPTY);
  const [stamp, setStamp] = useState(0);
  const queueRef = useRef(queue);
  const liveRef = useRef(flashLive(lines, modes));
  useLayoutEffect(() => {
    queueRef.current = queue;
    liveRef.current = flashLive(lines, modes);
  });

  useEffect(() => {
    if (!active) {
      seen.current = null;
      setQueue(EMPTY);
      return;
    }
    const live = flashLive(lines, modes);
    const { now, changed } = changedTexts(seen.current ?? new Map(), lines);
    const first = seen.current === null;
    seen.current = now;
    const flashed = first ? [] : changed.filter((item) => live(item) !== "gone");
    setQueue((current) => pruneFlash(queueFlash(current, flashed), live));
    const head = queueRef.current[0];
    if (head && flashed.includes(head.item)) setStamp((value) => value + 1);
  }, [active, lines, modes]);

  const head = queue[0] ?? null;
  const waiting = queue.length > 1;
  useEffect(() => {
    if (!head || (head.held && !waiting)) return;
    const timer = window.setTimeout(() => setQueue((current) => advanceFlash(current, liveRef.current)), head.held ? 0 : NOTCH_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [head, waiting, stamp]);

  const flashing = useMemo(() => new Set(head ? [head.item] : []), [head]);
  return useMemo(() => (active ? routeNotchText(lines, modes, flashing) : NONE), [active, lines, modes, flashing]);
}
