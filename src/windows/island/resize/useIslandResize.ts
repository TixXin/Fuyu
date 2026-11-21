import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { MAX_COLLAPSED_WIDTH_EXTRA, MIN_COLLAPSED_WIDTH_EXTRA, MIN_PANEL_WIDTH } from "../../../lib/settings/settingsLimits.ts";
import { MIN_PAGE_PANEL_HEIGHT, withPageSize } from "../../../lib/settings/pageSizes.ts";
import type { IslandSettings, PanelPageSize } from "../../../lib/settings/types";
import { clamp } from "../../../utils/number.ts";
import { throttle } from "../../../utils/throttle.ts";
import { listenIslandResize, type IslandResizeDelta } from "../api";
import { maxExpandedIslandHeight, maxExpandedIslandWidth } from "../layout";
import { defaultPageSize } from "../pageSize";
import { collapsedDetents, heightDetents, panelPresets, snap, snapPreset, widthDetents, type PresetId } from "./detents.ts";
import { endResizeDrag, getResizeState, setResizeLabel, type ResizeLabel } from "./session.ts";

const RESIZING_CLASS = "island-resizing";
const RESIZE_THROTTLE_MS = 16;

export type IslandResizeModel = ReturnType<typeof useIslandResize>;

export function useIslandResize(settings: IslandSettings, setSettings: (settings: IslandSettings) => void, page: string, pageSize: PanelPageSize) {
  const model = useMemo(() => {
    const width = { min: MIN_PANEL_WIDTH, max: maxExpandedIslandWidth(settings.expandedScale) };
    const height = { min: MIN_PAGE_PANEL_HEIGHT, max: maxExpandedIslandHeight(settings.expandedScale) };
    const collapsed = { min: MIN_COLLAPSED_WIDTH_EXTRA, max: MAX_COLLAPSED_WIDTH_EXTRA };
    const fallback = defaultPageSize(settings, page);
    return {
      limits: { width, height, collapsed },
      widths: widthDetents(fallback.width, width),
      heights: heightDetents(fallback.height, height),
      collapsedSteps: collapsedDetents(collapsed),
      presets: panelPresets(fallback, width, height),
    };
  }, [page, settings]);

  const latest = useRef({ settings, setSettings, page, pageSize, model });
  useLayoutEffect(() => {
    latest.current = { settings, setSettings, page, pageSize, model };
  });

  const savePanel = useCallback((size: PanelPageSize) => {
    const { settings: current, setSettings: save, page: currentPage } = latest.current;
    const saved = current.pageSizes[currentPage];
    if (saved?.width === size.width && saved?.height === size.height) return;
    save({ ...current, pageSizes: withPageSize(current.pageSizes, currentPage, size) });
  }, []);

  const saveCollapsed = useCallback((extra: number) => {
    const { settings: current, setSettings: save } = latest.current;
    if (extra !== current.collapsedWidthExtra) save({ ...current, collapsedWidthExtra: extra });
  }, []);

  const startRef = useRef<{ width: number; height: number; extra: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    const apply = ({ width, height, collapsed, done }: IslandResizeDelta) => {
      const { settings: current, pageSize: size, model: m } = latest.current;
      const start = (startRef.current ??= { width: size.width, height: size.height, extra: current.collapsedWidthExtra });
      const spec = getResizeState().drag;
      document.documentElement.classList.toggle(RESIZING_CLASS, !done);
      if (done) startRef.current = null;
      const label: ResizeLabel = {};
      if (collapsed) {
        const snapped = snap(start.extra + width, m.collapsedSteps, spec?.preset ? 16 : undefined);
        if (snapped.detent) label.width = snapped.detent;
        saveCollapsed(clamp(Math.round(snapped.value), m.limits.collapsed.min, m.limits.collapsed.max));
      } else {
        let next = { width: start.width + width, height: start.height + height };
        const preset = spec?.preset ? snapPreset(next.width, next.height, m.presets) : null;
        if (preset) {
          next = { width: preset.width, height: preset.height };
          label.preset = preset.id;
        } else {
          const w = width !== 0 ? snap(next.width, m.widths) : { value: next.width, detent: null };
          const h = height !== 0 ? snap(next.height, m.heights) : { value: next.height, detent: null };
          next = { width: w.value, height: h.value };
          if (w.detent) label.width = w.detent;
          if (h.detent) label.height = h.detent;
        }
        savePanel({
          width: clamp(Math.round(next.width), m.limits.width.min, m.limits.width.max),
          height: clamp(Math.round(next.height), m.limits.height.min, m.limits.height.max),
        });
      }
      setResizeLabel(label);
      if (done) endResizeDrag();
    };
    const throttled = throttle(apply, RESIZE_THROTTLE_MS);
    void listenIslandResize((delta) => {
      if (delta.done) {
        throttled.cancel();
        apply(delta);
        return;
      }
      throttled(delta);
    })
      .then((unlisten) => {
        if (cancelled) unlisten();
        else stop = unlisten;
      })
      .catch((error: unknown) => console.error("Failed to listen for island resizing", error));
    return () => {
      cancelled = true;
      throttled.cancel();
      stop?.();
      document.documentElement.classList.remove(RESIZING_CLASS);
    };
  }, [savePanel, saveCollapsed]);

  const applyPreset = useCallback((id: PresetId) => {
    const preset = latest.current.model.presets.find((entry) => entry.id === id);
    if (!preset) return;
    savePanel({ width: preset.width, height: preset.height });
    setResizeLabel({ preset: id });
  }, [savePanel]);

  const applyCollapsed = useCallback((extra: number) => {
    const { limits, collapsedSteps } = latest.current.model;
    const value = clamp(Math.round(extra), limits.collapsed.min, limits.collapsed.max);
    saveCollapsed(value);
    setResizeLabel({ width: collapsedSteps.find((step) => step.value === value)?.id });
  }, [saveCollapsed]);

  const nudge = useCallback((collapsed: boolean, dx: number, dy: number) => {
    const { settings: current, pageSize: size, model: m } = latest.current;
    if (collapsed) {
      applyCollapsed(current.collapsedWidthExtra + dx);
      return;
    }
    const width = clamp(size.width + dx, m.limits.width.min, m.limits.width.max);
    const height = clamp(size.height + dy, m.limits.height.min, m.limits.height.max);
    savePanel({ width, height });
    setResizeLabel({
      width: m.widths.find((detent) => detent.value === width)?.id,
      height: m.heights.find((detent) => detent.value === height)?.id,
    });
  }, [applyCollapsed, savePanel]);

  const snapshot = useCallback(() => {
    const { pageSizes, collapsedWidthExtra } = latest.current.settings;
    return { pageSizes, collapsedWidthExtra };
  }, []);
  const restore = useCallback((saved: Pick<IslandSettings, "pageSizes" | "collapsedWidthExtra">) => {
    const { settings: current, setSettings: save } = latest.current;
    save({ ...current, ...saved });
  }, []);

  return { ...model, applyPreset, applyCollapsed, nudge, snapshot, restore };
}
