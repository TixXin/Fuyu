// Where the guide's card sits on the overlay. Pure, so tests/unit/onboarding-placement.test.mjs
// can load it directly.
import type { IslandSpot } from "./api";

export type Viewport = { width: number; height: number };

export type CardPlacement = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

const CARD_WIDTH = 460;
const MARGIN = 16;
const GAP_BELOW_ISLAND = 28;
const DOCK_BOTTOM = 40;

/**
 * Below the island, centred on it as far as the screen allows. `anchor` is the island as last
 * seen closed, so the card stays put while the island opens over it. `dock` (the practice act,
 * or no island to point at) puts it at the bottom of the screen instead, clear of the open island.
 */
export function cardPlacement(anchor: IslandSpot | null, viewport: Viewport, dock: boolean): CardPlacement {
  const width = Math.min(CARD_WIDTH, viewport.width - MARGIN * 2);
  const centred = (viewport.width - width) / 2;
  if (dock || !anchor) {
    return { left: centred, width, bottom: DOCK_BOTTOM, maxHeight: viewport.height - DOCK_BOTTOM - MARGIN };
  }
  const left = Math.min(Math.max(anchor.x + anchor.width / 2 - width / 2, MARGIN), viewport.width - width - MARGIN);
  const top = Math.max(anchor.y + anchor.height + GAP_BELOW_ISLAND, MARGIN);
  return { left, width, top, maxHeight: Math.max(viewport.height - top - MARGIN, 0) };
}

/** The island as last seen closed: what `cardPlacement` anchors to. */
export function nextAnchor(previous: IslandSpot | null, spot: IslandSpot | null): IslandSpot | null {
  if (!spot) return previous;
  return spot.expanded ? previous ?? spot : spot;
}
