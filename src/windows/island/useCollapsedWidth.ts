import { useMemo, useSyncExternalStore } from "react";
import { visibleLines } from "../../features/plugin-kernel/islandContributions";
import { useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";
import { useTranslation } from "../../i18n";
import { collapsedWidth } from "./collapsedWidth";
import { collapsedFit } from "./collapsedFitStore";
import { collapsedContent } from "./collapsedContent";
import type { CollapsedSlots } from "./types";

type CollapsedWidthInput = {
  barText: boolean;
  noticeText: string | null;
  showTitle: boolean;
  widthExtra: number;
  peeking: boolean;
  slots: CollapsedSlots;
  collapsedScale?: number;
  growWidth?: number;
};

export function useCollapsedWidth({ barText, noticeText, showTitle, widthExtra, peeking, slots, collapsedScale = 1, growWidth = 0 }: CollapsedWidthInput) {
  const t = useTranslation();
  const { lines, alerts } = useIslandContributed();
  const fitWidth = useSyncExternalStore(collapsedFit.subscribe, collapsedFit.total);
  const contentWidth = useSyncExternalStore(collapsedContent.subscribe, collapsedContent.total);
  const alerted = alerts.size > 0;
  return useMemo(() => collapsedWidth({
    lines: visibleLines(lines, barText),
    noticeText,
    appName: t.island.appName,
    showTitle: barText && showTitle,
    widthExtra,
    peeking,
    center: Boolean(slots.center),
    centerWidth: slots.centerWidth ?? 0,
    sideWidth: slots.sideWidth ?? 0,
    fitWidth: fitWidth + Math.max(0, growWidth),
    contentWidth: growWidth > 0 ? 0 : contentWidth,
    alerted,
    collapsedScale,
    viewportWidth: window.innerWidth,
    devicePixelRatio: window.devicePixelRatio,
  }), [lines, barText, noticeText, t, showTitle, widthExtra, peeking, slots, fitWidth, contentWidth, alerted, collapsedScale, growWidth]);
}
