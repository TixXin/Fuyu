import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { onIslandMirrorFrame, requestIslandMirror } from "../../../features/plugin-kernel/api";
import type { MirrorFrame } from "../../../features/plugin-kernel/barMirror";
import { useVisibilityInterval } from "../../../lib/useVisibilityInterval";

const ASK_MS = 2000;
const GONE_MS = 6500;

export type BarMirrorView = { frame: MirrorFrame; live: boolean };

export function useBarMirror(): BarMirrorView | null {
  const [view, setView] = useState<BarMirrorView | null>(null);
  const heard = useRef(0);
  const ask = useCallback(() => {
    if (!isTauri()) return;
    if (heard.current > 0 && Date.now() - heard.current > GONE_MS) setView(null);
    void requestIslandMirror().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    let stop: (() => void) | null = null;
    void onIslandMirrorFrame((frame) => {
      if (cancelled) return;
      heard.current = Date.now();
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
  return view;
}
