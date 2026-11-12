import type { AgentSessionView } from "../../features/appearance/types";
import { clamp } from "../../utils/number.ts";
import { getCollapsedTextUnits } from "../../utils/text.ts";

export const MIN_COLLAPSED_ISLAND_WIDTH = 280;
export const MAX_COLLAPSED_ISLAND_WIDTH = 340;
export const MIN_COLLAPSED_TEXT_UNITS = 2;
export const MAX_COLLAPSED_TEXT_UNITS = 12;
export const BASE_EXPANDED_ISLAND_HEIGHT = 306;
export const EXPANDED_ISLAND_WIDTH = 560;
/**
 * A popup (new messages, an Agent alert) shows only its card, without the page header, on an
 * island this wide. Keep in step with .island--popup in IslandShell.css.
 */
export const POPUP_ISLAND_WIDTH = 400;
/** The island window's width (STAGE_WINDOW_WIDTH in src-tauri/src/island/geometry.rs). */
const STAGE_WINDOW_WIDTH = 820;

/**
 * The widest the expanded island may be at `scale` and still fit the island window (2px spare
 * each side), never below the usual width. Mirrors max_expanded_width in island/geometry.rs.
 */
export function maxExpandedIslandWidth(scale: number) {
  return Math.max(EXPANDED_ISLAND_WIDTH, Math.floor((STAGE_WINDOW_WIDTH - 4) / scale));
}

/** Every page's width (C25, C27): the panel width setting, as far as it fits at `scale`. */
export function panelIslandWidth(panelWidth: number, scale: number) {
  return Math.min(panelWidth, maxExpandedIslandWidth(scale));
}
/** What a popup leaves out: the header (34), the gap below it (14) and 10px of top padding. */
export const POPUP_HEADER_SAVING = 58;
/** An Agent alert popup also drops the list's 4px top padding (AgentSessionsPanel.css). */
export const AGENT_POPUP_LIST_SAVING = 4;
export const TODO_ROW_HEIGHT = 46;
export const TODO_GROW_START_ROWS = 2;
/** Collapsed width for the summary `text`, plus `extraWidth` px for plugin slots, up to the widest. */
export function getCollapsedIslandWidth(text: string, extraWidth = 0) {
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
  );
}

// Widest nudge allowed when aligning; covers the 1.25x and 1.75x display scales.
const MAX_ALIGNMENT_NUDGE = 4;

/**
 * The stage centres the island, so an odd width leaves it on a half pixel. The
 * compositor draws it there while the collapse animation runs and snaps it to
 * a whole device pixel when the animation ends, which shows as a jump. This
 * picks the nearest width whose centred left edge is a whole device pixel.
 */
export function alignCollapsedIslandWidth(
  width: number,
  stageWidth: number,
  devicePixelRatio: number,
) {
  const isAligned = (candidate: number) => {
    const left = ((stageWidth - candidate) / 2) * devicePixelRatio;
    return Math.abs(left - Math.round(left)) < 0.001;
  };

  for (let nudge = 0; nudge <= MAX_ALIGNMENT_NUDGE; nudge++) {
    for (const candidate of [width - nudge, width + nudge]) {
      if (
        candidate >= MIN_COLLAPSED_ISLAND_WIDTH &&
        candidate <= MAX_COLLAPSED_ISLAND_WIDTH &&
        isAligned(candidate)
      ) {
        return candidate;
      }
    }
  }

  return width;
}

/** Todo rows the expanded panel grows to before the list scrolls, within the tallest panel allowed. */
export function getTodoScrollStartRows(maxPanelHeight: number) {
  return (
    TODO_GROW_START_ROWS +
    Math.max(0, Math.floor((maxPanelHeight - BASE_EXPANDED_ISLAND_HEIGHT) / TODO_ROW_HEIGHT))
  );
}

// Expanded island around an empty Agent session list: island padding, header and gap (86), less
// the bottom padding (20) the list runs on through, then the list's top padding (4) and room
// below the last row (8). Keep in step with AgentSessionsPanel.css.
const AGENT_PAGE_CHROME_HEIGHT = 78;
// Each view's row and the gap below it: the tallest flat row (78, a two-line reply in
// AgentSessionsPanel.css; shorter replies and folded rows leave room for more sessions), a card
// (62) or a compact row (34) in AgentSessionCard.css. Keep in step with those files.
const AGENT_ROWS: Record<AgentSessionView, { height: number; gap: number }> = {
  list: { height: 78, gap: 2 },
  cards: { height: 62, gap: 6 },
  compact: { height: 34, gap: 4 },
};
// A usage line above the list (one per agent that reports usage): 22 plus 6 below it (AgentUsageBar.css).
const AGENT_USAGE_HEIGHT = 28;

/**
 * Expanded height that fits exactly `rows` Agent sessions, shown as `view`, below `usageLines`
 * usage lines (true: one).
 */
export function getAgentPageExpandedHeight(rows: number, usageLines: number | boolean = 0, view: AgentSessionView = "list") {
  const { height, gap } = AGENT_ROWS[view];
  return AGENT_PAGE_CHROME_HEIGHT + Number(usageLines) * AGENT_USAGE_HEIGHT + rows * (height + gap) - gap;
}

/** Expanded height around an alert's one-session card, whose row measured `rowHeight`. */
export function getAgentAlertExpandedHeight(rowHeight: number) {
  return AGENT_PAGE_CHROME_HEIGHT + rowHeight;
}

