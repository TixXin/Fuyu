import type { IslandSpot, SafeInsets } from "./api";
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
const NO_INSETS: SafeInsets = { top: 0, bottom: 0, left: 0, right: 0 };

function clampedHeight(viewport: Viewport, top: number, bottomMargin: number): number {
  return Math.max(MIN_HEIGHT, viewport.height - top - bottomMargin);
}

export function cardPlacement(
  island: IslandSpot | null,
  viewport: Viewport,
  layout: CardLayoutMode = "stage",
  workspace = false,
  insets: SafeInsets = NO_INSETS,
): CardPlacement {
  const safeLeft = Math.max(0, insets.left);
  const safeRight = Math.max(0, insets.right);
  const safeTop = Math.max(0, insets.top);
  const safeBottom = Math.max(0, insets.bottom);
  const usableWidth = Math.max(280, viewport.width - safeLeft - safeRight - MARGIN * 2);
  const width = Math.min(WIDTH_BY_LAYOUT[layout], usableWidth);
  const minX = safeLeft + MARGIN;
  const maxX = Math.max(minX, viewport.width - safeRight - width - MARGIN);
  const centeredLeft = Math.round(minX + (maxX - minX) / 2);
  const edgeBottom = safeBottom + MARGIN;
  const reserveBottom = safeBottom + BOTTOM_RESERVE;
  const minTop = safeTop + MARGIN;

  if (!island) {
    const top = Math.max(minTop, Math.round(Math.min(viewport.height * WORKSPACE_TOP_RATIO, WORKSPACE_TOP_MAX)));
    return { left: centeredLeft, width, top, maxHeight: clampedHeight(viewport, top, reserveBottom), centered: true };
  }

  const atBottom = island.y > viewport.height * 0.55;
  if (atBottom) {
    const top = Math.max(minTop, Math.round(Math.min(viewport.height * 0.08, 64)));
    const maxHeight = Math.max(MIN_HEIGHT, island.y - GAP - top);
    return { left: centeredLeft, width, top, maxHeight, centered: true };
  }

  const onSide = !island.expanded && island.width < 100 && island.height > 100;
  if (onSide) {
    const top = Math.max(minTop, Math.round(Math.min(viewport.height * WORKSPACE_TOP_RATIO, WORKSPACE_TOP_MAX)));
    const onLeft = island.x < viewport.width / 2;
    const minLeft = onLeft ? Math.max(minX, island.x + island.width + GAP) : minX;
    const maxLeft = onLeft ? maxX : Math.min(maxX, island.x - GAP - width);
    const left = Math.round(Math.min(Math.max(centeredLeft, minLeft), Math.max(minLeft, maxLeft)));
    return { left, width, top, maxHeight: clampedHeight(viewport, top, reserveBottom), centered: true };
  }

  const below = Math.max(island.y + island.height + GAP, minTop);

  if (workspace) {
    const preferredTop = Math.max(minTop, Math.round(Math.min(viewport.height * WORKSPACE_TOP_RATIO, WORKSPACE_TOP_MAX)));
    const top = Math.max(below, preferredTop);
    return { left: centeredLeft, width, top, maxHeight: clampedHeight(viewport, top, reserveBottom), centered: true };
  }

  if (!island.expanded) {
    const comfortableTop = Math.max(minTop, Math.min(CLOSED_TOP_MAX, Math.round(viewport.height * CLOSED_TOP_RATIO)));
    const top = Math.max(below, comfortableTop);
    if (viewport.height - top - edgeBottom >= ROOM_BELOW) {
      const left = Math.round(Math.min(Math.max(island.x + island.width / 2 - width / 2, minX), maxX));
      return { left, width, top, maxHeight: clampedHeight(viewport, top, edgeBottom), centered: false };
    }
  }

  if (viewport.height - below - edgeBottom >= ROOM_BELOW) {
    const left = Math.round(Math.min(Math.max(island.x + island.width / 2 - width / 2, minX), maxX));
    return { left, width, top: below, maxHeight: clampedHeight(viewport, below, edgeBottom), centered: false };
  }

  const sideTop = Math.max(island.y + MARGIN, minTop);
  const right = island.x + island.width + GAP;
  if (right <= maxX) {
    return { left: Math.round(right), width, top: sideTop, maxHeight: clampedHeight(viewport, sideTop, edgeBottom), centered: false };
  }
  const left = island.x - GAP - width;
  if (left >= minX) {
    return { left: Math.round(left), width, top: sideTop, maxHeight: clampedHeight(viewport, sideTop, edgeBottom), centered: false };
  }

  const fallbackTop = Math.max(minTop, viewport.height - reserveBottom - Math.min(460, viewport.height - reserveBottom - minTop));
  return { left: centeredLeft, width, top: fallbackTop, maxHeight: clampedHeight(viewport, fallbackTop, reserveBottom), centered: true };
}
