import { useEffect, useMemo, useRef, useState } from "react";
import type { IslandLineContribution } from "../../features/plugin-kernel/islandContributions";
import { useNotchTextModes } from "../../lib/settings/collapsedText";
import { changedTexts, NOTCH_FLASH_MS, routeNotchText, type NotchTextRoute } from "./notchText";

const NONE: NotchTextRoute = { row: null, panel: [] };

export function useNotchText(active: boolean, lines: readonly IslandLineContribution[]): NotchTextRoute {
  const modes = useNotchTextModes();
  const seen = useRef<ReadonlyMap<string, string> | null>(null);
  const timers = useRef(new Map<string, number>());
  const [flashing, setFlashing] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    if (!active) {
      seen.current = null;
      return;
    }
    const { now, changed } = changedTexts(seen.current ?? new Map(), lines);
    const first = seen.current === null;
    seen.current = now;
    const flashed = first ? [] : changed.filter((item) => lines.some((line) => line.item === item));
    if (flashed.length === 0) return;
    setFlashing((current) => new Set([...current, ...flashed]));
    for (const item of flashed) {
      window.clearTimeout(timers.current.get(item));
      timers.current.set(item, window.setTimeout(() => {
        timers.current.delete(item);
        setFlashing((current) => {
          const next = new Set(current);
          next.delete(item);
          return next;
        });
      }, NOTCH_FLASH_MS));
    }
  }, [active, lines]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  return useMemo(() => (active ? routeNotchText(lines, modes, flashing) : NONE), [active, lines, modes, flashing]);
}
