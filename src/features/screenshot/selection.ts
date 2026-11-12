export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type PixelRect = { x: number; y: number; width: number; height: number };
export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const HANDLES: readonly Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export const MIN_SELECTION = 4;

export function pixelScale(picture: Size, view: Size): number {
  return view.width > 0 ? picture.width / view.width : 1;
}

export function toPixels(point: Point, scale: number): Point {
  return { x: point.x * scale, y: point.y * scale };
}

export function toCss(rect: PixelRect, scale: number): PixelRect {
  return { x: rect.x / scale, y: rect.y / scale, width: rect.width / scale, height: rect.height / scale };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function pixelAt(point: Point, bounds: Size): Point {
  return { x: clamp(Math.floor(point.x), 0, bounds.width - 1), y: clamp(Math.floor(point.y), 0, bounds.height - 1) };
}

export function rectFromPoints(a: Point, b: Point, bounds: Size): PixelRect {
  const left = clamp(Math.round(Math.min(a.x, b.x)), 0, bounds.width);
  const top = clamp(Math.round(Math.min(a.y, b.y)), 0, bounds.height);
  const right = clamp(Math.round(Math.max(a.x, b.x)), 0, bounds.width);
  const bottom = clamp(Math.round(Math.max(a.y, b.y)), 0, bounds.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function isSelection(rect: PixelRect): boolean {
  return rect.width >= MIN_SELECTION && rect.height >= MIN_SELECTION;
}

export function resizeRect(rect: PixelRect, handle: Handle, point: Point, bounds: Size): PixelRect {
  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.width;
  let bottom = rect.y + rect.height;
  if (handle.includes("w")) left = point.x;
  if (handle.includes("e")) right = point.x;
  if (handle.includes("n")) top = point.y;
  if (handle.includes("s")) bottom = point.y;
  return rectFromPoints({ x: left, y: top }, { x: right, y: bottom }, bounds);
}

export function moveRect(rect: PixelRect, dx: number, dy: number, bounds: Size): PixelRect {
  return {
    ...rect,
    x: clamp(Math.round(rect.x + dx), 0, bounds.width - rect.width),
    y: clamp(Math.round(rect.y + dy), 0, bounds.height - rect.height),
  };
}

export function hitTest(rect: PixelRect, point: Point, tolerance: number): Handle | "inside" | null {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const near = (a: number, b: number) => Math.abs(a - b) <= tolerance;
  const withinX = point.x >= rect.x - tolerance && point.x <= right + tolerance;
  const withinY = point.y >= rect.y - tolerance && point.y <= bottom + tolerance;
  if (!withinX || !withinY) return null;
  const vertical = near(point.y, rect.y) ? "n" : near(point.y, bottom) ? "s" : "";
  const horizontal = near(point.x, rect.x) ? "w" : near(point.x, right) ? "e" : "";
  const handle = `${vertical}${horizontal}`;
  if (handle) return handle as Handle;
  return point.x > rect.x && point.x < right && point.y > rect.y && point.y < bottom ? "inside" : null;
}

export function handlePosition(rect: PixelRect, handle: Handle): Point {
  const x = handle.includes("w") ? rect.x : handle.includes("e") ? rect.x + rect.width : rect.x + rect.width / 2;
  const y = handle.includes("n") ? rect.y : handle.includes("s") ? rect.y + rect.height : rect.y + rect.height / 2;
  return { x, y };
}

export function handleCursor(handle: Handle): string {
  return handle === "n" || handle === "s" ? "ns-resize"
    : handle === "e" || handle === "w" ? "ew-resize"
    : handle === "nw" || handle === "se" ? "nwse-resize"
    : "nesw-resize";
}

export function hexColor(red: number, green: number, blue: number): string {
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export function magnifierPosition(pointer: Point, size: Size, view: Size, gap: number): Point {
  let x = pointer.x + gap;
  let y = pointer.y + gap;
  if (x + size.width > view.width) x = pointer.x - gap - size.width;
  if (y + size.height > view.height) y = pointer.y - gap - size.height;
  return { x: Math.max(0, x), y: Math.max(0, y) };
}
