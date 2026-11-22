import { cellsToPx } from "../../../lib/settings/customPanels.ts";

export const FUYU_COLUMNS = 6;
export const FUYU_ROWS = 2;
export const FUYU_BOARD_TOP_PX = 2;
const EXPANDED_PADDING_X = 40;
const EXPANDED_CHROME_HEIGHT = 10 + 34 + 14 + 20;

export const FUYU_ISLAND_SIZE = {
  width: cellsToPx(FUYU_COLUMNS) + EXPANDED_PADDING_X,
  height: cellsToPx(FUYU_ROWS) + FUYU_BOARD_TOP_PX + EXPANDED_CHROME_HEIGHT,
} as const;

export function stripRoom(size: { width: number; height: number }) {
  return { width: Math.max(0, size.width - EXPANDED_PADDING_X), height: Math.max(0, size.height - EXPANDED_CHROME_HEIGHT) };
}
