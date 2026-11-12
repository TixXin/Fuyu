import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  MAX_COLLAPSED_WIDTH_EXTRA, MAX_MAX_PANEL_HEIGHT, MAX_PANEL_WIDTH, MIN_COLLAPSED_WIDTH_EXTRA, MIN_MAX_PANEL_HEIGHT,
  MIN_PANEL_WIDTH,
} from "../../features/appearance/settings";
import type { IslandSettings } from "../../features/appearance/types";
import { clamp } from "../../utils/number.ts";
import { listenIslandResize, setIslandPanelResizable } from "./api";
import { maxExpandedIslandWidth } from "./layout";

const RESIZING_CLASS = "island-resizing";

export function useIslandResize(settings: IslandSettings, setSettings: (settings: IslandSettings) => void, popup: boolean) {
  const [resizingHeight, setResizingHeight] = useState(false);
  const [resizing, setResizing] = useState<"panel" | "collapsed" | null>(null);
  const latest = useRef({ settings, setSettings });
  useLayoutEffect(() => {
    latest.current = { settings, setSettings };
  });
  const startRef = useRef<{ width: number; height: number; collapsedExtra: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    void listenIslandResize(({ width, height, collapsed, done }) => {
      const { settings: current, setSettings: save } = latest.current;
      const start = (startRef.current ??= {
        width: current.panelWidth,
        height: current.maxPanelHeight,
        collapsedExtra: current.collapsedWidthExtra,
      });
      if (done) startRef.current = null;
      document.documentElement.classList.toggle(RESIZING_CLASS, !done);
      setResizing(done ? null : collapsed ? "collapsed" : "panel");
      if (collapsed) {
        const collapsedWidthExtra = clamp(Math.round(start.collapsedExtra + width), MIN_COLLAPSED_WIDTH_EXTRA, MAX_COLLAPSED_WIDTH_EXTRA);
        if (collapsedWidthExtra !== current.collapsedWidthExtra) save({ ...current, collapsedWidthExtra });
        return;
      }
      const maxWidth = Math.min(MAX_PANEL_WIDTH, maxExpandedIslandWidth(current.expandedScale));
      const panelWidth = clamp(Math.round(start.width + width), MIN_PANEL_WIDTH, maxWidth);
      const maxPanelHeight = clamp(Math.round(start.height + height), MIN_MAX_PANEL_HEIGHT, MAX_MAX_PANEL_HEIGHT);
      if (panelWidth !== current.panelWidth || maxPanelHeight !== current.maxPanelHeight) {
        save({ ...current, panelWidth, maxPanelHeight });
      }
      setResizingHeight(!done && height !== 0);
    })
      .then((unlisten) => {
        if (cancelled) unlisten();
        else stop = unlisten;
      })
      .catch((error: unknown) => console.error("Failed to listen for island resizing", error));
    return () => {
      cancelled = true;
      stop?.();
      document.documentElement.classList.remove(RESIZING_CLASS);
    };
  }, []);

  useEffect(() => {
    void setIslandPanelResizable(!popup).catch((error: unknown) => console.error("Failed to set the panel resizable", error));
  }, [popup]);

  return { resizingHeight, resizing };
}
