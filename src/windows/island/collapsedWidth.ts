import type { IslandLineContribution } from "../../features/plugin-kernel/islandContributions.ts";
import { measuredLine } from "../../features/plugin-kernel/islandContributions.ts";
import { alignCollapsedIslandWidth, getCollapsedIslandWidth, getNoticeIslandWidth, maxCollapsedIslandWidth } from "./layout.ts";

const TODO_CENTER_GAP = 6;
const NOTICE_EXTRA_WIDTH = 180;

export type CollapsedWidthInput = {
  lines: readonly IslandLineContribution[];
  noticeText: string | null;
  appName: string;
  showTitle: boolean;
  widthExtra: number;
  peeking: boolean;
  center: boolean;
  centerWidth: number;
  sideWidth: number;
  fitWidth?: number;
  collapsedScale?: number;
  viewportWidth: number;
  devicePixelRatio: number;
};

export function collapsedWidth({ lines, noticeText, appName, showTitle, widthExtra, peeking, center, centerWidth, sideWidth, fitWidth = 0, collapsedScale = 1, viewportWidth, devicePixelRatio }: CollapsedWidthInput) {
  const cap = maxCollapsedIslandWidth(collapsedScale);
  const fit = (width: number) => fitWidth > 0
    ? alignCollapsedIslandWidth(Math.min(cap, width + fitWidth), viewportWidth, devicePixelRatio, widthExtra, cap)
    : alignCollapsedIslandWidth(Math.min(cap, width), viewportWidth, devicePixelRatio, widthExtra);
  if (noticeText !== null) return fit(getNoticeIslandWidth(noticeText, sideWidth + NOTICE_EXTRA_WIDTH, widthExtra));
  const line = measuredLine(lines);
  const text = line?.measure ?? (showTitle ? appName : "");
  const patternWidth = !center ? 0 : line?.center ? centerWidth + TODO_CENTER_GAP : text === "" && !peeking ? centerWidth : 0;
  const extraWidth = sideWidth + (line?.extra ?? 0) + patternWidth;
  return fit(getCollapsedIslandWidth(text, extraWidth, widthExtra));
}
