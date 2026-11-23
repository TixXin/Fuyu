import { useEffect, useRef, useState } from "react";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import type { AgentSessionSummary } from "./api";
import { loadTide, recordTide, saveTide, TIDE_STORAGE_KEY, type TideDay } from "./tide";

const SAMPLE_MS = 60_000;

export function useTideRecorder(sessions: readonly AgentSessionSummary[], enabled: boolean) {
  const tide = useRef<TideDay | null>(null);
  const latest = useRef(sessions);

  useEffect(() => {
    if (!enabled) return;
    const sample = () => {
      const now = Date.now();
      const current = tide.current ?? loadTide(now);
      const next = recordTide(current, latest.current, now);
      if (next !== current || tide.current === null) {
        tide.current = next;
        if (next !== current) saveTide(next);
      }
    };
    sample();
    const timer = window.setInterval(sample, SAMPLE_MS);
    return () => window.clearInterval(timer);
  }, [enabled]);

  useEffect(() => {
    latest.current = sessions;
    if (!enabled || tide.current === null) return;
    const now = Date.now();
    const next = recordTide(tide.current, sessions, now);
    if (next === tide.current) return;
    tide.current = next;
    saveTide(next);
  }, [sessions, enabled]);
}

export function useTide(enabled: boolean): TideDay | null {
  const [tide, setTide] = useState<TideDay | null>(() => (enabled ? loadTide(Date.now()) : null));

  useEffect(() => {
    if (!enabled) return;
    const read = () => setTide(loadTide(Date.now()));
    read();
    const stop = visibilityInterval(read, SAMPLE_MS);
    const onStorage = (event: StorageEvent) => {
      if (event.key === TIDE_STORAGE_KEY) read();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      stop();
      window.removeEventListener("storage", onStorage);
    };
  }, [enabled]);

  return enabled ? tide : null;
}
