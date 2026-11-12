import type { PixelRect, Point } from "./selection";

export type AnnotationTool = "rect" | "ellipse" | "arrow" | "pen" | "highlighter" | "text" | "mosaic" | "number";

export const ANNOTATION_TOOLS: readonly AnnotationTool[] = ["rect", "ellipse", "arrow", "pen", "highlighter", "text", "mosaic", "number"];

export const ANNOTATION_COLORS = ["#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#0A84FF", "#AF52DE", "#FFFFFF", "#000000"] as const;

export type StrokeLevel = 0 | 1 | 2;
export const STROKE_LEVELS: readonly StrokeLevel[] = [0, 1, 2];

const LINE = [2, 4, 8];
const TEXT = [16, 22, 32];
const BADGE = [11, 14, 18];

export type AnnotationStyle = { color: string; level: StrokeLevel };

export type ShapeAnnotation = { kind: "rect" | "ellipse" | "arrow" | "mosaic"; color: string; width: number; from: Point; to: Point };
export type StrokeAnnotation = { kind: "pen" | "highlighter"; color: string; width: number; points: Point[] };
export type TextAnnotation = { kind: "text"; color: string; size: number; at: Point; text: string };
export type NumberAnnotation = { kind: "number"; color: string; size: number; at: Point; value: number };
export type Annotation = ShapeAnnotation | StrokeAnnotation | TextAnnotation | NumberAnnotation;

export const lineWidth = (level: StrokeLevel, scale: number) => LINE[level] * scale;
export const textSize = (level: StrokeLevel, scale: number) => TEXT[level] * scale;
export const badgeRadius = (level: StrokeLevel, scale: number) => BADGE[level] * scale;
export const TEXT_LINE_HEIGHT = 1.3;
export const HIGHLIGHTER_FACTOR = 4;
export const mosaicBlock = (width: number) => Math.max(6, Math.round(width * 3));

export function nextNumber(items: readonly Annotation[]): number {
  return items.reduce((top, item) => (item.kind === "number" ? Math.max(top, item.value) : top), 0) + 1;
}

export function startAnnotation(tool: AnnotationTool, at: Point, style: AnnotationStyle, scale: number, items: readonly Annotation[]): Annotation | null {
  const width = lineWidth(style.level, scale);
  switch (tool) {
    case "rect":
    case "ellipse":
    case "arrow":
    case "mosaic":
      return { kind: tool, color: style.color, width, from: at, to: at };
    case "pen":
      return { kind: "pen", color: style.color, width, points: [at] };
    case "highlighter":
      return { kind: "highlighter", color: style.color, width: width * HIGHLIGHTER_FACTOR, points: [at] };
    case "number":
      return { kind: "number", color: style.color, size: badgeRadius(style.level, scale), at, value: nextNumber(items) };
    case "text":
      return null;
  }
}

export function extendAnnotation(annotation: Annotation, to: Point): Annotation {
  switch (annotation.kind) {
    case "pen":
    case "highlighter": {
      const last = annotation.points[annotation.points.length - 1];
      if (last && Math.hypot(to.x - last.x, to.y - last.y) < 1) return annotation;
      return { ...annotation, points: [...annotation.points, to] };
    }
    case "text":
    case "number":
      return annotation;
    default:
      return { ...annotation, to };
  }
}

export function isMeaningful(annotation: Annotation): boolean {
  switch (annotation.kind) {
    case "rect":
    case "ellipse":
    case "mosaic": {
      const rect = normalizedRect(annotation.from, annotation.to);
      return rect.width >= 3 && rect.height >= 3;
    }
    case "arrow":
      return Math.hypot(annotation.to.x - annotation.from.x, annotation.to.y - annotation.from.y) >= 4;
    case "pen":
    case "highlighter":
      return annotation.points.length >= 2;
    case "text":
      return annotation.text.trim().length > 0;
    case "number":
      return true;
  }
}

export function normalizedRect(a: Point, b: Point): PixelRect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}

export function arrowGeometry(from: Point, to: Point, width: number) {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const head = Math.min(Math.max(10, width * 4), length / 2);
  const ux = (to.x - from.x) / length;
  const uy = (to.y - from.y) / length;
  const base = { x: to.x - ux * head, y: to.y - uy * head };
  const half = head * 0.5;
  return {
    tip: to,
    left: { x: base.x - uy * half, y: base.y + ux * half },
    right: { x: base.x + uy * half, y: base.y - ux * half },
    base,
  };
}

export type AnnotationHistory = { items: readonly Annotation[]; undone: readonly Annotation[] };

export const EMPTY_HISTORY: AnnotationHistory = { items: [], undone: [] };

export function addAnnotation(history: AnnotationHistory, annotation: Annotation): AnnotationHistory {
  return { items: [...history.items, annotation], undone: [] };
}

export function undoAnnotation(history: AnnotationHistory): AnnotationHistory {
  const last = history.items[history.items.length - 1];
  return last ? { items: history.items.slice(0, -1), undone: [...history.undone, last] } : history;
}

export function redoAnnotation(history: AnnotationHistory): AnnotationHistory {
  const next = history.undone[history.undone.length - 1];
  return next ? { items: [...history.items, next], undone: history.undone.slice(0, -1) } : history;
}

function grow(rect: PixelRect, by: number): PixelRect {
  return { x: rect.x - by, y: rect.y - by, width: rect.width + by * 2, height: rect.height + by * 2 };
}

function pointsBox(points: readonly Point[]): PixelRect {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return normalizedRect({ x: Math.min(...xs), y: Math.min(...ys) }, { x: Math.max(...xs), y: Math.max(...ys) });
}

export function annotationBounds(item: Annotation): PixelRect {
  switch (item.kind) {
    case "rect":
    case "ellipse":
      return grow(normalizedRect(item.from, item.to), item.width);
    case "mosaic":
      return grow(normalizedRect(item.from, item.to), 1);
    case "arrow":
      return grow(normalizedRect(item.from, item.to), Math.max(10, item.width * 4) + item.width);
    case "pen":
    case "highlighter":
      return grow(pointsBox(item.points), item.width);
    case "text": {
      const lines = item.text.split("\n");
      const longest = Math.max(...lines.map((line) => [...line].length));
      return grow({ x: item.at.x, y: item.at.y, width: longest * item.size * 1.1, height: lines.length * item.size * TEXT_LINE_HEIGHT }, item.size * 0.5);
    }
    case "number":
      return grow({ x: item.at.x, y: item.at.y, width: 0, height: 0 }, item.size + 2);
  }
}

export function annotationArea(items: readonly Annotation[], selection: PixelRect): PixelRect | null {
  if (items.length === 0) return null;
  const boxes = items.map(annotationBounds);
  const left = Math.max(selection.x, Math.floor(Math.min(...boxes.map((box) => box.x))));
  const top = Math.max(selection.y, Math.floor(Math.min(...boxes.map((box) => box.y))));
  const right = Math.min(selection.x + selection.width, Math.ceil(Math.max(...boxes.map((box) => box.x + box.width))));
  const bottom = Math.min(selection.y + selection.height, Math.ceil(Math.max(...boxes.map((box) => box.y + box.height))));
  return right > left && bottom > top ? { x: left, y: top, width: right - left, height: bottom - top } : null;
}
