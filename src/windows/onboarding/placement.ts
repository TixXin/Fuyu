import type { IslandSpot } from "./api";

export type Viewport = { width: number; height: number };

export type CardPlacement = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

const CARD_WIDTH = 460;
const MARGIN = 16;
const GAP = 28;
const DOCK_BOTTOM = 40;
const ROOM_BELOW = 380;

export function cardPlacement(island: IslandSpot | null, viewport: Viewport): CardPlacement {
  const width = Math.min(CARD_WIDTH, viewport.width - MARGIN * 2);
  const docked: CardPlacement = { left: (viewport.width - width) / 2, width, bottom: DOCK_BOTTOM, maxHeight: viewport.height - DOCK_BOTTOM - MARGIN };
  if (!island) return docked;

  const below = Math.max(island.y + island.height + GAP, MARGIN);
  if (viewport.height - below - MARGIN >= ROOM_BELOW) {
    const left = Math.min(Math.max(island.x + island.width / 2 - width / 2, MARGIN), viewport.width - width - MARGIN);
    return { left, width, top: below, maxHeight: viewport.height - below - MARGIN };
  }

  const top = Math.max(island.y + MARGIN, MARGIN);
  const right = island.x + island.width + GAP;
  if (viewport.width - right - MARGIN >= width) return { left: right, width, top, maxHeight: viewport.height - top - MARGIN };
  const left = island.x - GAP - width;
  if (left >= MARGIN) return { left, width, top, maxHeight: viewport.height - top - MARGIN };
  return docked;
}
