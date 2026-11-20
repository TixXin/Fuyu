import { HIGHLIGHTER_FACTOR, STROKE_LEVELS, annotationBounds, badgeRadius, lineWidth, normalizedRect, textSize, type Annotation, type StrokeLevel } from "./annotations.ts";
import type { PixelRect, Point } from "./selection";

export type AnnotationHandle = "start" | "end" | "nw" | "ne" | "sw" | "se";

function inside(rect: PixelRect, point: Point, by = 0): boolean {
  return point.x >= rect.x - by && point.x <= rect.x + rect.width + by && point.y >= rect.y - by && point.y <= rect.y + rect.height + by;
}

function segmentDistance(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function nearLine(points: readonly Point[], point: Point, reach: number): boolean {
  if (points.length === 1) return Math.hypot(point.x - points[0].x, point.y - points[0].y) <= reach;
  for (let index = 1; index < points.length; index += 1) {
    if (segmentDistance(point, points[index - 1], points[index]) <= reach) return true;
  }
  return false;
}

export function hitsAnnotation(item: Annotation, point: Point, slack: number): boolean {
  switch (item.kind) {
    case "rect": {
      const rect = normalizedRect(item.from, item.to);
      const reach = slack + item.width / 2;
      const hollow = rect.width > reach * 2 && rect.height > reach * 2 && inside({ x: rect.x + reach, y: rect.y + reach, width: rect.width - reach * 2, height: rect.height - reach * 2 }, point);
      return inside(rect, point, reach) && !hollow;
    }
    case "ellipse": {
      const rect = normalizedRect(item.from, item.to);
      const rx = rect.width / 2;
      const ry = rect.height / 2;
      const reach = slack + item.width / 2;
      if (rx < reach || ry < reach) return inside(rect, point, reach);
      const distance = Math.hypot((point.x - rect.x - rx) / rx, (point.y - rect.y - ry) / ry);
      return Math.abs(distance - 1) * Math.min(rx, ry) <= reach;
    }
    case "mosaic":
      return inside(normalizedRect(item.from, item.to), point, slack);
    case "arrow":
      return nearLine([item.from, item.to], point, slack + item.width);
    case "pen":
    case "highlighter":
      return nearLine(item.points, point, slack + item.width / 2);
    case "text":
    case "number":
      return inside(annotationBounds(item), point, slack);
  }
}

export function annotationAt(items: readonly Annotation[], point: Point, slack: number): Annotation | null {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (hitsAnnotation(items[index], point, slack)) return items[index];
  }
  return null;
}

export function annotationHandles(item: Annotation): { handle: AnnotationHandle; at: Point }[] {
  switch (item.kind) {
    case "arrow":
      return [{ handle: "start", at: item.from }, { handle: "end", at: item.to }];
    case "rect":
    case "ellipse":
    case "mosaic": {
      const rect = normalizedRect(item.from, item.to);
      const right = rect.x + rect.width;
      const bottom = rect.y + rect.height;
      return [
        { handle: "nw", at: { x: rect.x, y: rect.y } },
        { handle: "ne", at: { x: right, y: rect.y } },
        { handle: "se", at: { x: right, y: bottom } },
        { handle: "sw", at: { x: rect.x, y: bottom } },
      ];
    }
    default:
      return [];
  }
}

export function handleAt(item: Annotation, point: Point, reach: number): AnnotationHandle | null {
  const found = annotationHandles(item).find(({ at }) => Math.hypot(point.x - at.x, point.y - at.y) <= reach);
  return found ? found.handle : null;
}

const shift = (point: Point, dx: number, dy: number): Point => ({ x: point.x + dx, y: point.y + dy });

export function moveAnnotation(item: Annotation, dx: number, dy: number): Annotation {
  switch (item.kind) {
    case "pen":
    case "highlighter":
      return { ...item, points: item.points.map((point) => shift(point, dx, dy)) };
    case "text":
    case "number":
      return { ...item, at: shift(item.at, dx, dy) };
    default:
      return { ...item, from: shift(item.from, dx, dy), to: shift(item.to, dx, dy) };
  }
}

export function dragHandle(item: Annotation, handle: AnnotationHandle, point: Point): Annotation {
  if (item.kind === "arrow") return handle === "start" ? { ...item, from: point } : handle === "end" ? { ...item, to: point } : item;
  if (item.kind !== "rect" && item.kind !== "ellipse" && item.kind !== "mosaic") return item;
  if (handle === "start" || handle === "end") return item;
  const rect = normalizedRect(item.from, item.to);
  const opposite = { x: handle.includes("w") ? rect.x + rect.width : rect.x, y: handle.includes("n") ? rect.y + rect.height : rect.y };
  return { ...item, from: opposite, to: point };
}

export function canRecolor(item: Annotation): boolean {
  return item.kind !== "mosaic";
}

export function restyleAnnotation(item: Annotation, change: { color?: string; level?: StrokeLevel }, scale: number): Annotation {
  const color = change.color !== undefined && canRecolor(item) ? change.color : item.color;
  const level = change.level;
  if (level === undefined) return color === item.color ? item : { ...item, color };
  switch (item.kind) {
    case "text":
      return { ...item, color, size: textSize(level, scale) };
    case "number":
      return { ...item, color, size: badgeRadius(level, scale) };
    case "highlighter":
      return { ...item, color, width: lineWidth(level, scale) * HIGHLIGHTER_FACTOR };
    default:
      return { ...item, color, width: lineWidth(level, scale) };
  }
}

export function annotationLevel(item: Annotation, scale: number): StrokeLevel | null {
  const size = (candidate: Annotation) => ("width" in candidate ? candidate.width : candidate.size);
  return STROKE_LEVELS.find((level) => Math.abs(size(restyleAnnotation(item, { level }, scale)) - size(item)) < 0.01) ?? null;
}
