import type { IslandLineContribution } from "../../features/plugin-kernel/islandContributions.ts";
import { measuredLine } from "../../features/plugin-kernel/islandContributions.ts";
import { alignCollapsedIslandWidth, getCollapsedIslandWidth, getNoticeIslandWidth } from "./layout.ts";

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
  viewportWidth: number;
  devicePixelRatio: number;
};

export function collapsedWidth({ lines, noticeText, appName, showTitle, widthExtra, peeking, center, centerWidth, sideWidth, viewportWidth, devicePixelRatio }: CollapsedWidthInput) {
  if (noticeText !== null) {
    return alignCollapsedIslandWidth(getNoticeIslandWidth(noticeText, sideWidth + NOTICE_EXTRA_WIDTH, widthExtra), viewportWidth, devicePixelRatio, widthExtra);
  }
  const line = measuredLine(lines);
  const text = line?.measure ?? (showTitle ? appName : "");
  const patternWidth = !center ? 0 : line?.center ? centerWidth + TODO_CENTER_GAP : text === "" && !peeking ? centerWidth : 0;
  const extraWidth = sideWidth + (line?.extra ?? 0) + patternWidth;
  return alignCollapsedIslandWidth(getCollapsedIslandWidth(text, extraWidth, widthExtra), viewportWidth, devicePixelRatio, widthExtra);
}
