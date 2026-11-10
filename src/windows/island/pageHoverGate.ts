/**
 * When hovering a page button switches pages.
 *
 * Pages differ in width (the system monitor 800, the calendar 680, others 560) and the island
 * stays centred, so a page switch slides the header's buttons sideways. A button that slides
 * under a resting pointer gets a pointer enter (and Chromium may send a move at the same spot);
 * that must not switch again, or pages switch back and forth. So only a pointer that really
 * moved counts.
 *
 * A pointer passing over buttons on its way to another must not switch either: every switch
 * mounts a page, resizes the island window and restarts the island's resize animation, and
 * sweeping across five buttons used to do that five times. So the pointer has to rest on a
 * button for a moment (PAGE_HOVER_INTENT_MS, or the user's longer delay).
 *
 * While the island still resizes after a switch, a real move is not dropped but waits until it
 * has settled; the button is then switched to if the pointer is still on it.
 */
export type PageHoverGate = { last: { x: number; y: number } | null; settleUntil: number };

/** Most of the island's 560ms resize (IslandShell.css); what is left moves the buttons a pixel or two. */
export const PAGE_SWITCH_SETTLE_MS = 450;
/** How long the pointer rests on a button before it counts as aiming there, not passing over. */
export const PAGE_HOVER_INTENT_MS = 120;

export function createPageHoverGate(): PageHoverGate {
  return { last: null, settleUntil: 0 };
}

/** The page changed (by hover, click or shortcut): hovering waits until the island has settled. */
export function settlePageHover(gate: PageHoverGate, now: number) {
  gate.settleUntil = now + PAGE_SWITCH_SETTLE_MS;
}

/**
 * A pointer move over a page button at (x, y): whether it is a real move, at another spot than
 * the last move seen (a button sliding under a resting pointer is not). Every move is remembered.
 */
export function pageHoverMoved(gate: PageHoverGate, x: number, y: number) {
  const moved = gate.last === null || gate.last.x !== x || gate.last.y !== y;
  gate.last = { x, y };
  return moved;
}

/** How long from `now` to switch to the button just moved onto: the rest of the settling, then the intent or the user's delay. */
export function pageHoverWait(gate: PageHoverGate, delayMs: number, now: number) {
  return Math.max(0, gate.settleUntil - now) + Math.max(delayMs, PAGE_HOVER_INTENT_MS);
}
