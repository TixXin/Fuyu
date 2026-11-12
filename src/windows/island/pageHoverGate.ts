export type PageHoverGate = { last: { x: number; y: number } | null; settleUntil: number };

export const PAGE_SWITCH_SETTLE_MS = 450;
export const PAGE_HOVER_INTENT_MS = 120;

export function createPageHoverGate(): PageHoverGate {
  return { last: null, settleUntil: 0 };
}

export function settlePageHover(gate: PageHoverGate, now: number) {
  gate.settleUntil = now + PAGE_SWITCH_SETTLE_MS;
}

export function pageHoverMoved(gate: PageHoverGate, x: number, y: number) {
  const moved = gate.last === null || gate.last.x !== x || gate.last.y !== y;
  gate.last = { x, y };
  return moved;
}

export function pageHoverWait(gate: PageHoverGate, delayMs: number, now: number) {
  return Math.max(0, gate.settleUntil - now) + Math.max(delayMs, PAGE_HOVER_INTENT_MS);
}
