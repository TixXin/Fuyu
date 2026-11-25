import type { IslandSpot } from "./api";
import type { CardLayoutMode } from "./flow.ts";

export type Viewport = { width: number; height: number };

export type CardPlacement = { left: number; width: number; top: number; maxHeight: number; centered: boolean };

const COMPACT_WIDTH = 480;
const WIDE_WIDTH = 640;
const MARGIN = 16;
const GAP = 28;
const CLOSED_TOP_RATIO = 0.13;
const CLOSED_TOP_MAX = 128;
const DOCK_BOTTOM = 40;
const ROOM_BELOW = 320;
const WORKSPACE_TOP_RATIO = 0.12;
const WORKSPACE_TOP_MAX = 112;
const MIN_HEIGHT = 240;

function clampedHeight(viewport: Viewport, top: number): number {
  return Math.max(MIN_HEIGHT, viewport.height - top - MARGIN);
}

export function cardPlacement(
  island: IslandSpot | null,
  viewport: Viewport,
  layout: CardLayoutMode = "compact",
  workspace = false,
): CardPlacement {
  const targetWidth = layout === "wide" ? WIDE_WIDTH : COMPACT_WIDTH;
  const width = Math.min(targetWidth, Math.max(280, viewport.width - MARGIN * 2));
  const centeredLeft = Math.round((viewport.width - width) / 2);

  if (workspace || !island) {
    const islandBottom = island ? Math.max(island.y + island.height + GAP, MARGIN) : MARGIN;
    const preferredTop = Math.round(Math.min(viewport.height * WORKSPACE_TOP_RATIO, WORKSPACE_TOP_MAX));
    const top = Math.max(islandBottom, preferredTop);
    const maxHeight = Math.max(MIN_HEIGHT, viewport.height - top - DOCK_BOTTOM);
    return { left: centeredLeft, width, top, maxHeight, centered: true };
  }

  const below = Math.max(island.y + island.height + GAP, MARGIN);
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

  const fallbackTop = Math.max(MARGIN, viewport.height - DOCK_BOTTOM - Math.min(460, viewport.height - DOCK_BOTTOM - MARGIN));
  return { left: centeredLeft, width, top: fallbackTop, maxHeight: Math.max(MIN_HEIGHT, viewport.height - fallbackTop - DOCK_BOTTOM), centered: true };
}
