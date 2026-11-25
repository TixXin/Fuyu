import type { IslandSpot } from "./api";
import type { CardLayoutMode } from "./flow.ts";

export type Viewport = { width: number; height: number };

export type CardPlacement = { left: number; width: number; top: number; maxHeight: number; centered: boolean };

const WIDTH_BY_LAYOUT: Record<CardLayoutMode, number> = {
  compact: 480,
  wide: 660,
  stage: 760,
};
const MARGIN = 16;
const GAP = 24;
const CLOSED_TOP_RATIO = 0.11;
const CLOSED_TOP_MAX = 108;
const BOTTOM_RESERVE = 40;
const ROOM_BELOW = 320;
const WORKSPACE_TOP_RATIO = 0.11;
const WORKSPACE_TOP_MAX = 104;
const MIN_HEIGHT = 240;

function clampedHeight(viewport: Viewport, top: number, bottomMargin = MARGIN): number {
  return Math.max(MIN_HEIGHT, viewport.height - top - bottomMargin);
}

export function cardPlacement(
  island: IslandSpot | null,
  viewport: Viewport,
  layout: CardLayoutMode = "stage",
  workspace = false,
): CardPlacement {
  const width = Math.min(WIDTH_BY_LAYOUT[layout], Math.max(280, viewport.width - MARGIN * 2));
  const centeredLeft = Math.round((viewport.width - width) / 2);

  if (!island) {
    const top = Math.round(Math.min(viewport.height * WORKSPACE_TOP_RATIO, WORKSPACE_TOP_MAX));
    return { left: centeredLeft, width, top, maxHeight: clampedHeight(viewport, top, BOTTOM_RESERVE), centered: true };
  }

  const atBottom = island.y > viewport.height * 0.55;
  if (atBottom) {
    const top = Math.max(MARGIN, Math.round(Math.min(viewport.height * 0.08, 64)));
    const maxHeight = Math.max(MIN_HEIGHT, island.y - GAP - top);
    return { left: centeredLeft, width, top, maxHeight, centered: true };
  }

  const onSide = !island.expanded && island.width < 100 && island.height > 100;
  if (onSide) {
    const top = Math.round(Math.min(viewport.height * WORKSPACE_TOP_RATIO, WORKSPACE_TOP_MAX));
    const onLeft = island.x < viewport.width / 2;
    const minLeft = onLeft ? island.x + island.width + GAP : MARGIN;
    const maxLeft = onLeft ? viewport.width - width - MARGIN : island.x - GAP - width;
    const left = Math.round(Math.min(Math.max(centeredLeft, minLeft), Math.max(minLeft, maxLeft)));
    return { left, width, top, maxHeight: clampedHeight(viewport, top, BOTTOM_RESERVE), centered: true };
  }

  const below = Math.max(island.y + island.height + GAP, MARGIN);

  if (workspace) {
    const preferredTop = Math.round(Math.min(viewport.height * WORKSPACE_TOP_RATIO, WORKSPACE_TOP_MAX));
    const top = Math.max(below, preferredTop);
    return { left: centeredLeft, width, top, maxHeight: clampedHeight(viewport, top, BOTTOM_RESERVE), centered: true };
  }

  if (!island.expanded) {
    const comfortableTop = Math.min(CLOSED_TOP_MAX, Math.round(viewport.height * CLOSED_TOP_RATIO));
    const top = Math.max(below, comfortableTop);
    if (viewport.height - top - MARGIN >= ROOM_BELOW) {
      const left = Math.round(Math.min(Math.max(island.x + island.width / 2 - width / 2, MARGIN), viewport.width - width - MARGIN));
      return { left, width, top, maxHeight: clampedHeight(viewport, top), centered: false };
    }
  }

  if (viewport.height - below - MARGIN >= ROOM_BELOW) {
    const left = Math.round(Math.min(Math.max(island.x + island.width / 2 - width / 2, MARGIN), viewport.width - width - MARGIN));
    return { left, width, top: below, maxHeight: clampedHeight(viewport, below), centered: false };
  }

  const sideTop = Math.max(island.y + MARGIN, MARGIN);
  const right = island.x + island.width + GAP;
  if (viewport.width - right - MARGIN >= width) {
    return { left: Math.round(right), width, top: sideTop, maxHeight: clampedHeight(viewport, sideTop), centered: false };
  }
  const left = island.x - GAP - width;
  if (left >= MARGIN) {
    return { left: Math.round(left), width, top: sideTop, maxHeight: clampedHeight(viewport, sideTop), centered: false };
  }

  const fallbackTop = Math.max(MARGIN, viewport.height - BOTTOM_RESERVE - Math.min(460, viewport.height - BOTTOM_RESERVE - MARGIN));
  return { left: centeredLeft, width, top: fallbackTop, maxHeight: clampedHeight(viewport, fallbackTop, BOTTOM_RESERVE), centered: true };
}
