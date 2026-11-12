import type { PixelRect, Point, Size } from "./selection";

export type Target = PixelRect & {
  window: number;
  element: boolean;
};

function contains(rect: PixelRect, point: Point) {
  return point.x >= rect.x && point.x < rect.x + rect.width && point.y >= rect.y && point.y < rect.y + rect.height;
}

const area = (rect: PixelRect) => rect.width * rect.height;
const same = (a: PixelRect, b: PixelRect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

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

export function stepLayer(level: number, deltaY: number, count: number): number {
  const next = level + (deltaY < 0 ? 1 : deltaY > 0 ? -1 : 0);
  return Math.min(Math.max(next, 0), Math.max(count - 1, 0));
}

export function layersKey(layers: readonly PixelRect[]): string {
  const inner = layers[0];
  return inner ? `${layers.length}:${inner.x},${inner.y},${inner.width},${inner.height}` : "";
}
