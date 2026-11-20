import { MAX_TOP_FILLET_RADIUS } from "./settingsLimits.ts";

export const STAGE_WINDOW_WIDTH = 820;
const STAGE_PADDING_Y = 24;
const MIN_PANEL_ROOM_WIDTH = 560;
const MIN_PANEL_ROOM_HEIGHT = 710;

function positive(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

export function screenRoom() {
  const screen = typeof window === "undefined" ? undefined : window.screen;
  return {
    width: positive(screen?.availWidth, STAGE_WINDOW_WIDTH),
    height: positive(screen?.availHeight, MIN_PANEL_ROOM_HEIGHT + STAGE_PADDING_Y),
  };
}

export function maxPanelWidthFor(scale: number, roomWidth = screenRoom().width) {
  const safeScale = positive(scale, 1);
  return Math.max(MIN_PANEL_ROOM_WIDTH, Math.floor((Math.max(roomWidth, STAGE_WINDOW_WIDTH) - 4) / safeScale) - 2 * MAX_TOP_FILLET_RADIUS);
}

export function maxPanelHeightFor(scale: number, roomHeight = screenRoom().height) {
  const safeScale = positive(scale, 1);
  return Math.max(MIN_PANEL_ROOM_HEIGHT, Math.floor((roomHeight - STAGE_PADDING_Y) / safeScale));
}
