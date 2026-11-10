// What the selection snaps to (C41.2): the windows on screen and the controls inside them, in
// the monitor picture's pixels. Hovering highlights the innermost one under the pointer, the wheel
// steps out to its parents and back, a click selects it.

import type { PixelRect, Point, Size } from "./selection";

// Mirrored by LocalTarget in src-tauri/src/screenshot/targets.rs.
export type Target = PixelRect & {
  /** The window's place in the z-order, 0 on top; a control has its window's. */
  window: number;
  element: boolean;
};

function contains(rect: PixelRect, point: Point) {
  return point.x >= rect.x && point.x < rect.x + rect.width && point.y >= rect.y && point.y < rect.y + rect.height;
}

const area = (rect: PixelRect) => rect.width * rect.height;
const same = (a: PixelRect, b: PixelRect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/**
 * The rectangles under `point`, innermost first: the controls of the topmost window there (only
 * that window: the ones below are covered at this point), the window itself, then the whole
 * monitor. Duplicates (a control the size of its window) appear once.
 */
export function layersAt(targets: readonly Target[], point: Point, bounds: Size): PixelRect[] {
  let top = Infinity;
  for (const target of targets) {
    if (!target.element && target.window < top && contains(target, point)) top = target.window;
  }
  const hits = targets.filter((target) => target.window === top && contains(target, point));
  const ordered = [...hits].sort((a, b) => area(a) - area(b) || Number(b.element) - Number(a.element));
  const layers: PixelRect[] = [];
  for (const { x, y, width, height } of [...ordered, { x: 0, y: 0, ...bounds }]) {
    const rect = { x, y, width, height };
    if (!layers.some((layer) => same(layer, rect))) layers.push(rect);
  }
  return layers;
}

/** The layer after a wheel step: up (negative delta) goes outward, down inward, kept in range. */
export function stepLayer(level: number, deltaY: number, count: number): number {
  const next = level + (deltaY < 0 ? 1 : deltaY > 0 ? -1 : 0);
  return Math.min(Math.max(next, 0), Math.max(count - 1, 0));
}

/** A key for the layers under the pointer: the chosen level resets when they change. */
export function layersKey(layers: readonly PixelRect[]): string {
  const inner = layers[0];
  return inner ? `${layers.length}:${inner.x},${inner.y},${inner.width},${inner.height}` : "";
}
