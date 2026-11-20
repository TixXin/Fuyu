import { useEffect, useState } from "react";
import { useTranslation } from "../../i18n";
import { listenIslandLayer } from "../../lib/island-layer/api";
import { shortcutLabel } from "../../lib/shortcut/shortcut";
import type { IslandMode } from "./types";

const SHOW_MS = 1400;

export function useIslandLayerNotice({ mode, isTucked, shortcut }: { mode: IslandMode; isTucked: boolean; shortcut: string }) {
  const copy = useTranslation().island.layerNotice;
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    void listenIslandLayer((front) => setLeaving(!front))
      .then((unlisten) => {
        if (cancelled) unlisten();
        else stop = unlisten;
      })
      .catch((error: unknown) => console.error("Failed to listen for the island layer", error));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setLeaving(false), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  const active = leaving && mode === "collapsed" && !isTucked;
  const text = active ? copy(shortcut ? shortcutLabel(shortcut) : null) : null;
  return { active, text };
}

export type IslandLayerNoticeController = ReturnType<typeof useIslandLayerNotice>;
