import { dropHitAt, sheetPoint, type DropHit } from "./dropHits";
import type { DropSpot } from "./gridTarget";
import type { Pointer } from "./useEdgeFlip";

export type SpotContext = {
  overview: boolean;
  boardPoint: () => { x: number; y: number } | null;
  viewWidth: number;
  boardHeight: number;
  pageStepPx: number;
  pageCount: number;
  page: number;
};

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), Math.max(low, high));

export function resolveSpot(pointer: Pointer, context: SpotContext): { spot: DropSpot | null; hit: DropHit | null } {
  const hit = dropHitAt(pointer.x, pointer.y);
  if (hit?.kind === "tray") return { spot: { kind: "tray" }, hit };
  if (hit?.kind === "page") return { spot: { kind: "page", page: hit.index }, hit };
  if (hit?.kind === "new") return { spot: { kind: "new" }, hit };
  if (hit?.kind === "sheet") {
    if (hit.index >= context.pageCount) return { spot: { kind: "new" }, hit };
    return { spot: { kind: "board", ...sheetPoint(hit, pointer.x, pointer.y, context.viewWidth, context.boardHeight, context.pageStepPx) }, hit };
  }
  if (hit?.kind === "all" || context.overview) return { spot: null, hit };
  const point = context.boardPoint();
  if (!point) return { spot: null, hit: null };
  const low = context.page * context.pageStepPx;
  return { spot: { kind: "board", x: clamp(point.x, low, low + context.viewWidth - 1), y: clamp(point.y, 0, context.boardHeight - 1) }, hit: null };
}

export function withinArea(area: HTMLElement | null, pointer: Pointer, reach: number): boolean {
  if (!area) return false;
  const rect = area.getBoundingClientRect();
  return pointer.x >= rect.left - reach && pointer.x <= rect.right + reach && pointer.y >= rect.top && pointer.y <= rect.bottom;
}
