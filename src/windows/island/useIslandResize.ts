import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MAX_MAX_PANEL_HEIGHT, MAX_PANEL_WIDTH, MIN_MAX_PANEL_HEIGHT, MIN_PANEL_WIDTH } from "../../features/appearance/settings";
import type { IslandSettings } from "../../features/appearance/types";
import { clamp } from "../../utils/number.ts";
import { listenIslandResize } from "./api";
import { maxExpandedIslandWidth } from "./layout";

/**
 * Alt + dragging the open panel's side or bottom edge (C25): the native side reports how much
 * wider and taller it has got since the press, and this turns that into the panel width and
 * height settings. Returns whether the height is being dragged, so the island can show the panel
 * at that height meanwhile (most pages are shorter than the most they may grow to).
 */
export function useIslandResize(settings: IslandSettings, setSettings: (settings: IslandSettings) => void) {
  const [resizingHeight, setResizingHeight] = useState(false);
  const latest = useRef({ settings, setSettings });
  useLayoutEffect(() => {
    latest.current = { settings, setSettings };
  });
  // The sizes when the drag began.
  const startRef = useRef<{ width: number; height: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    void listenIslandResize(({ width, height, done }) => {
      const { settings: current, setSettings: save } = latest.current;
      const start = (startRef.current ??= { width: current.panelWidth, height: current.maxPanelHeight });
      const maxWidth = Math.min(MAX_PANEL_WIDTH, maxExpandedIslandWidth(current.expandedScale));
      const panelWidth = clamp(Math.round(start.width + width), MIN_PANEL_WIDTH, maxWidth);
      const maxPanelHeight = clamp(Math.round(start.height + height), MIN_MAX_PANEL_HEIGHT, MAX_MAX_PANEL_HEIGHT);
      if (panelWidth !== current.panelWidth || maxPanelHeight !== current.maxPanelHeight) {
        save({ ...current, panelWidth, maxPanelHeight });
      }
      setResizingHeight(!done && height !== 0);
      if (done) startRef.current = null;
    })
      .then((unlisten) => {
        if (cancelled) unlisten();
        else stop = unlisten;
      })
      .catch((error: unknown) => console.error("Failed to listen for island resizing", error));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return resizingHeight;
}
