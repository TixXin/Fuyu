import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  MAX_COLLAPSED_WIDTH_EXTRA, MIN_COLLAPSED_WIDTH_EXTRA, MIN_PANEL_WIDTH,
} from "../../lib/settings/settings";
import { MIN_PAGE_PANEL_HEIGHT, withPageSize } from "../../lib/settings/pageSizes.ts";
import type { IslandSettings, PanelPageSize } from "../../lib/settings/types";
import { clamp } from "../../utils/number.ts";
import { throttle } from "../../utils/throttle.ts";
import { listenIslandResize, setIslandPanelResizable, type IslandResizeDelta } from "./api";
import { maxExpandedIslandHeight, maxExpandedIslandWidth } from "./layout";

const RESIZING_CLASS = "island-resizing";
const RESIZE_THROTTLE_MS = 16;

export function useIslandResize(
  settings: IslandSettings,
  setSettings: (settings: IslandSettings) => void,
  popup: boolean,
  page: string,
  pageSize: PanelPageSize,
) {
  const [resizingHeight, setResizingHeight] = useState(false);
  const [resizing, setResizing] = useState<"panel" | "collapsed" | null>(null);
  const latest = useRef({ settings, setSettings, page, pageSize });
  useLayoutEffect(() => {
    latest.current = { settings, setSettings, page, pageSize };
  });
  const startRef = useRef<{ page: string; width: number; height: number; collapsedExtra: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    const applyDelta = ({ width, height, collapsed, done }: IslandResizeDelta) => {
      const { settings: current, setSettings: save, page: currentPage, pageSize: currentSize } = latest.current;
      const start = (startRef.current ??= {
        page: currentPage,
        width: currentSize.width,
        height: currentSize.height,
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
      const size = {
        width: clamp(Math.round(start.width + width), MIN_PANEL_WIDTH, maxExpandedIslandWidth(current.expandedScale)),
        height: clamp(Math.round(start.height + height), MIN_PAGE_PANEL_HEIGHT, maxExpandedIslandHeight(current.expandedScale)),
      };
      const saved = current.pageSizes[start.page];
      if (saved?.width !== size.width || saved?.height !== size.height) {
        save({ ...current, pageSizes: withPageSize(current.pageSizes, start.page, size) });
      }
      setResizingHeight(!done && height !== 0);
    };
    const throttledApply = throttle(applyDelta, RESIZE_THROTTLE_MS);
    void listenIslandResize((delta) => {
      if (delta.done) {
        throttledApply.cancel();
        applyDelta(delta);
        return;
      }
      throttledApply(delta);
    })
      .then((unlisten) => {
        if (cancelled) unlisten();
        else stop = unlisten;
      })
      .catch((error: unknown) => console.error("Failed to listen for island resizing", error));
    return () => {
      cancelled = true;
      throttledApply.cancel();
      stop?.();
      document.documentElement.classList.remove(RESIZING_CLASS);
    };
  }, []);

  useEffect(() => {
    void setIslandPanelResizable(!popup).catch((error: unknown) => console.error("Failed to set the panel resizable", error));
  }, [popup]);

  return { resizingHeight, resizing };
}
