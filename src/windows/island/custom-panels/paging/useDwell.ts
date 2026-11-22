import { useEffect, useRef, useState } from "react";

export const PAGE_DWELL_MS = 320;
export const OVERVIEW_DWELL_MS = 350;

export function useDwell(key: string | null, ms: number, onFire: (key: string) => void): number {
  const [progress, setProgress] = useState(0);
  const fire = useRef(onFire);
  useEffect(() => {
    fire.current = onFire;
  });
  useEffect(() => {
    if (key === null) return;
    const start = performance.now();
    let frame = 0;
    let shown = 0;
    const tick = (now: number) => {
      const next = Math.min(1, (now - start) / ms);
      if (next - shown >= 0.04 || next === 1) {
        shown = next;
        setProgress(next);
      }
      if (next < 1) frame = window.requestAnimationFrame(tick);
      else fire.current(key);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      setProgress(0);
    };
  }, [key, ms]);
  return key === null ? 0 : progress;
}
