const EDGE = 8;
export const CARD_OFFSET = 8;
const CURSOR_LEFT = 8;
const CURSOR_RIGHT = 22;

export function cardLeft(center: number, width: number, viewport: number, pointerX: number | null) {
  const clamp = (left: number) => Math.min(Math.max(left, EDGE), viewport - width - EDGE);
  const left = clamp(center - width / 2);
  if (pointerX === null || left >= pointerX + CURSOR_RIGHT || left + width <= pointerX - CURSOR_LEFT) return left;
  const before = pointerX - CURSOR_LEFT - width;
  return before >= EDGE ? before : clamp(pointerX + CURSOR_RIGHT);
}
