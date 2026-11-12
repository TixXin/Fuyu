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
