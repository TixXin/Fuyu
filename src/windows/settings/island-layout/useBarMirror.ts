import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { onIslandMirrorFrame, requestIslandMirror } from "../../../features/plugin-kernel/api";
import type { MirrorFrame, MirrorMiss } from "../../../features/plugin-kernel/barMirror";
import { useVisibilityInterval } from "../../../lib/useVisibilityInterval";

const ASK_MS = 2000;
const GONE_MS = 6500;

export type BarMirrorView = { frame: MirrorFrame; live: boolean };
export type BarMirrorState = { view: BarMirrorView | null; miss: MirrorMiss | "silent" | null };

export function useBarMirror(): BarMirrorState {
  const [view, setView] = useState<BarMirrorView | null>(null);
  const [miss, setMiss] = useState<BarMirrorState["miss"]>(null);
  const heard = useRef(0);
  const asked = useRef(0);
  const ask = useCallback(() => {
    if (!isTauri()) return;
    const now = Date.now();
    asked.current ||= now;
    const since = heard.current || asked.current;
    if (now - since > GONE_MS) {
      setView(null);
      setMiss("silent");
    }
    void requestIslandMirror().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    let stop: (() => void) | null = null;
    void onIslandMirrorFrame((frame) => {
      if (cancelled) return;
      heard.current = Date.now();
      setMiss(frame.shown ? null : frame.miss);
      setView((current) => (frame.shown ? { frame, live: true } : current ? { frame: current.frame, live: false } : null));
    })
      .then((unlisten) => {
        if (cancelled) return unlisten();
        stop = unlisten;
        ask();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [ask]);

  useVisibilityInterval(ask, ASK_MS);
  return { view, miss };
}
