import type { AgentSessionView } from "../../features/appearance/types";
import { clamp } from "../../utils/number.ts";
import { getCollapsedTextUnits } from "../../utils/text.ts";

export const MIN_COLLAPSED_ISLAND_WIDTH = 280;
export const MAX_COLLAPSED_ISLAND_WIDTH = 340;
export const MIN_COLLAPSED_TEXT_UNITS = 2;
export const MAX_COLLAPSED_TEXT_UNITS = 12;
export const BASE_EXPANDED_ISLAND_HEIGHT = 306;
export const EXPANDED_ISLAND_WIDTH = 560;
export const POPUP_ISLAND_WIDTH = 400;
const STAGE_WINDOW_WIDTH = 820;

export function maxExpandedIslandWidth(scale: number) {
  return Math.max(EXPANDED_ISLAND_WIDTH, Math.floor((STAGE_WINDOW_WIDTH - 4) / scale));
}

export function panelIslandWidth(panelWidth: number, scale: number) {
  return Math.min(panelWidth, maxExpandedIslandWidth(scale));
}
export const POPUP_HEADER_SAVING = 58;
export const AGENT_POPUP_LIST_SAVING = 4;
export const TODO_ROW_HEIGHT = 34;
export const TODO_GROW_START_ROWS = 2;
export function getCollapsedIslandWidth(text: string, extraWidth = 0, widthExtra = 0) {
  const visualUnits = getCollapsedTextUnits(text);
  const widthProgress =
    (clamp(
      visualUnits,
      MIN_COLLAPSED_TEXT_UNITS,
      MAX_COLLAPSED_TEXT_UNITS,
    ) -
      MIN_COLLAPSED_TEXT_UNITS) /
    (MAX_COLLAPSED_TEXT_UNITS - MIN_COLLAPSED_TEXT_UNITS);

  return Math.min(
    MAX_COLLAPSED_ISLAND_WIDTH,
    Math.round(
      MIN_COLLAPSED_ISLAND_WIDTH +
        widthProgress * (MAX_COLLAPSED_ISLAND_WIDTH - MIN_COLLAPSED_ISLAND_WIDTH) +
        Math.max(0, extraWidth),
    ),
  ) + Math.round(widthExtra);
}

const MAX_NOTICE_ISLAND_WIDTH = 460;
const NOTICE_UNIT_WIDTH = 13.5;

export function getNoticeIslandWidth(text: string, chromeWidth: number, widthExtra = 0) {
  const width = Math.round(getCollapsedTextUnits(text) * NOTICE_UNIT_WIDTH + Math.max(0, chromeWidth));
  return Math.min(MAX_NOTICE_ISLAND_WIDTH, Math.max(MIN_COLLAPSED_ISLAND_WIDTH, width)) + Math.round(widthExtra);
}

const MAX_ALIGNMENT_NUDGE = 4;

export function alignCollapsedIslandWidth(
  width: number,
  stageWidth: number,
  devicePixelRatio: number,
  widthExtra = 0,
) {
  const isAligned = (candidate: number) => {
    const left = ((stageWidth - candidate) / 2) * devicePixelRatio;
    return Math.abs(left - Math.round(left)) < 0.001;
  };

  for (let nudge = 0; nudge <= MAX_ALIGNMENT_NUDGE; nudge++) {
    for (const candidate of [width - nudge, width + nudge]) {
      if (
        candidate >= MIN_COLLAPSED_ISLAND_WIDTH + widthExtra &&
        candidate <= MAX_COLLAPSED_ISLAND_WIDTH + widthExtra &&
        isAligned(candidate)
      ) {
        return candidate;
      }
    }
  }

  return width;
}

export function getTodoScrollStartRows(maxPanelHeight: number) {
  return (
    TODO_GROW_START_ROWS +
    Math.max(0, Math.floor((maxPanelHeight - BASE_EXPANDED_ISLAND_HEIGHT) / TODO_ROW_HEIGHT))
  );
}

const AGENT_PAGE_CHROME_HEIGHT = 78;
const AGENT_ROWS: Record<AgentSessionView, { height: number; gap: number }> = {
  list: { height: 78, gap: 2 },
  cards: { height: 62, gap: 6 },
  compact: { height: 34, gap: 4 },
};
const AGENT_USAGE_HEIGHT = 28;

export function getAgentPageExpandedHeight(rows: number, usageLines: number | boolean = 0, view: AgentSessionView = "list") {
  const { height, gap } = AGENT_ROWS[view];
  return AGENT_PAGE_CHROME_HEIGHT + Number(usageLines) * AGENT_USAGE_HEIGHT + rows * (height + gap) - gap;
}

export function getAgentAlertExpandedHeight(rowHeight: number) {
  return AGENT_PAGE_CHROME_HEIGHT + rowHeight;
}

