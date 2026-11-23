type Point = { x: number; y: number };

export type PageHoverGate = {
  last: Point | null;
  anchor: Point | null;
  settleUntil: number;
  spots: ReadonlyMap<string, number>;
  blocked: string | null;
};

export const PAGE_SWITCH_SETTLE_MS = 600;
export const PAGE_HOVER_INTENT_MS = 120;
export const PAGE_HOVER_REST_PX = 4;
const SLID_PX = 1;

export function createPageHoverGate(): PageHoverGate {
  return { last: null, anchor: null, settleUntil: 0, spots: new Map(), blocked: null };
}

export function settlePageHover(gate: PageHoverGate, now: number, spots: ReadonlyMap<string, number> = new Map()) {
  gate.settleUntil = now + PAGE_SWITCH_SETTLE_MS;
  gate.spots = spots;
  gate.blocked = null;
  gate.anchor = null;
}

export function pageHoverMoved(gate: PageHoverGate, x: number, y: number) {
  const moved = gate.last === null || gate.last.x !== x || gate.last.y !== y;
  gate.last = { x, y };
  return moved;
}

export function pageHoverRestarts(gate: PageHoverGate, x: number, y: number) {
  const anchor = gate.anchor;
  if (anchor !== null && Math.hypot(x - anchor.x, y - anchor.y) <= PAGE_HOVER_REST_PX) return false;
  gate.anchor = { x, y };
  return true;
}

export function forgetPageHoverRest(gate: PageHoverGate) {
  gate.anchor = null;
}

export function pageHoverWait(gate: PageHoverGate, delayMs: number, now: number) {
  return Math.max(0, gate.settleUntil - now) + Math.max(delayMs, PAGE_HOVER_INTENT_MS);
}

export function blockSlidPage(gate: PageHoverGate, hovered: { page: string; left: number } | null, current: string) {
  if (hovered === null || hovered.page === current) return;
  const before = gate.spots.get(hovered.page);
  if (before !== undefined && Math.abs(before - hovered.left) > SLID_PX) gate.blocked = hovered.page;
}

export function pageHoverBlocked(gate: PageHoverGate, page: string) {
  return gate.blocked === page;
}

export function leavePageHover(gate: PageHoverGate, page: string) {
  if (gate.blocked === page) gate.blocked = null;
  gate.anchor = null;
}
