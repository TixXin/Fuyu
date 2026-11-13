import type { Point } from "./selection";

export type Edges = { left: number; right: number; top: number; bottom: number };
export type Ruler = { dx: number; dy: number; length: number };

export const EDGE_TOLERANCE = 16;

function same(line: Uint8ClampedArray, a: number, b: number, tolerance: number): boolean {
  for (let channel = 0; channel < 3; channel += 1) {
    if (Math.abs(line[a * 4 + channel] - line[b * 4 + channel]) > tolerance) return false;
  }
  return true;
}

export function spanAround(line: Uint8ClampedArray, at: number, tolerance = EDGE_TOLERANCE): [number, number] {
  const length = Math.floor(line.length / 4);
  if (length === 0) return [0, 0];
  const origin = Math.min(Math.max(Math.floor(at), 0), length - 1);
  let start = origin;
  while (start > 0 && same(line, start - 1, origin, tolerance)) start -= 1;
  let end = origin + 1;
  while (end < length && same(line, end, origin, tolerance)) end += 1;
  return [start, end];
}

export function edgesAround(row: Uint8ClampedArray, column: Uint8ClampedArray, pixel: Point, tolerance = EDGE_TOLERANCE): Edges {
  const [left, right] = spanAround(row, pixel.x, tolerance);
  const [top, bottom] = spanAround(column, pixel.y, tolerance);
  return { left, right, top, bottom };
}

export function rulerBetween(from: Point, to: Point): Ruler {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  return { dx, dy, length: Math.round(Math.hypot(dx, dy) * 10) / 10 };
}
