export const MIN_PIN_SCALE = 0.1;
export const MAX_PIN_SCALE = 8;
export const MIN_PIN_OPACITY = 0.2;
const ZOOM_STEP = 1.1;
const FADE_STEP = 0.1;

export function nextScale(scale: number, deltaY: number): number {
  if (deltaY === 0) return scale;
  const next = deltaY < 0 ? scale * ZOOM_STEP : scale / ZOOM_STEP;
  const clamped = Math.min(MAX_PIN_SCALE, Math.max(MIN_PIN_SCALE, next));
  return Math.abs(clamped - 1) < 0.02 ? 1 : clamped;
}

export function nextOpacity(opacity: number, deltaY: number): number {
  if (deltaY === 0) return opacity;
  const next = deltaY < 0 ? opacity + FADE_STEP : opacity - FADE_STEP;
  return Math.round(Math.min(1, Math.max(MIN_PIN_OPACITY, next)) * 10) / 10;
}

export type PinCommand = "close" | "copy" | "save" | "toggle" | "actualSize" | "annotate" | "text" | "left" | "right" | "flipX" | "flipY" | "collapse";

const PLAIN_KEYS: Record<string, PinCommand> = {
  escape: "close",
  t: "toggle",
  " ": "annotate",
  o: "text",
  "1": "left",
  "2": "right",
  "3": "flipX",
  "4": "flipY",
  m: "collapse",
};

const CTRL_KEYS: Record<string, PinCommand> = { c: "copy", s: "save", "0": "actualSize" };

export function pinKeyCommand(key: string, ctrl: boolean): PinCommand | null {
  const name = key.toLowerCase();
  return (ctrl ? CTRL_KEYS[name] : PLAIN_KEYS[name]) ?? null;
}

export const PIN_COLLAPSED_SIDE = 56;
const DOUBLE_CLICK_MS = 350;
const DOUBLE_CLICK_REACH = 6;

export function isDoubleClick(previous: { at: number; x: number; y: number } | null, next: { at: number; x: number; y: number }): boolean {
  return previous !== null && next.at - previous.at <= DOUBLE_CLICK_MS && Math.hypot(next.x - previous.x, next.y - previous.y) <= DOUBLE_CLICK_REACH;
}
