export const CLICK_EXPAND_WINDOW_MS = 1000;
export const CLICK_FOCUS_RETRY_MS = 120;
export const CLICK_FOCUS_MAX_TRIES = 10;

export function expandedByClick(pressedAt: number | null, now: number): boolean {
  return pressedAt !== null && now >= pressedAt && now - pressedAt <= CLICK_EXPAND_WINDOW_MS;
}
