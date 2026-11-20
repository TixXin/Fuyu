import { useSyncExternalStore } from "react";
import { cellsToPx } from "../../../lib/settings/customPanels.ts";

export const FUYU_COLUMNS = 6;
export const FUYU_ROWS = 2;
export const FUYU_BOARD_TOP_PX = 2;
const EXPANDED_PADDING_X = 40;
const EXPANDED_CHROME_HEIGHT = 10 + 34 + 14 + 20;
const MIN_BOARD_HEIGHT = cellsToPx(FUYU_ROWS);

let boardHeight = MIN_BOARD_HEIGHT;
const listeners = new Set<() => void>();

export function reportFuyuBoardHeight(height: number) {
  if (height === boardHeight) return;
  boardHeight = height;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useFuyuBoardHeight(): number {
  return useSyncExternalStore(subscribe, () => boardHeight);
}

export function fuyuIslandSize(height: number, maxPanelHeight: number) {
  const most = Math.max(MIN_BOARD_HEIGHT, maxPanelHeight - EXPANDED_CHROME_HEIGHT - FUYU_BOARD_TOP_PX);
  const board = Math.min(Math.max(height, MIN_BOARD_HEIGHT), most);
  return { width: cellsToPx(FUYU_COLUMNS) + EXPANDED_PADDING_X, height: board + FUYU_BOARD_TOP_PX + EXPANDED_CHROME_HEIGHT };
}
