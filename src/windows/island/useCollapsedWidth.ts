import { useMemo } from "react";
import { visibleLines } from "../../features/plugin-kernel/islandContributions";
import { useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";
import { useTranslation } from "../../i18n";
import { collapsedWidth } from "./collapsedWidth";
import type { CollapsedSlots } from "./types";

type CollapsedWidthInput = {
  barText: boolean;
  noticeText: string | null;
  showTitle: boolean;
  widthExtra: number;
  peeking: boolean;
  slots: CollapsedSlots;
};

export function useCollapsedWidth({ barText, noticeText, showTitle, widthExtra, peeking, slots }: CollapsedWidthInput) {
  const t = useTranslation();
  const { lines } = useIslandContributed();
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
    viewportWidth: window.innerWidth,
    devicePixelRatio: window.devicePixelRatio,
  }), [lines, barText, noticeText, t, showTitle, widthExtra, peeking, slots]);
}
