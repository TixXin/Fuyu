import { isMacOS } from "../../lib/platform.ts";
import { isPrimaryKey } from "../../lib/shortcut/shortcut.ts";

export type ImageSize = { width: number; height: number };
export type ImagePoint = { x: number; y: number };
export type ImageRect = ImageSize & ImagePoint;
export type QuarterTurn = 1 | -1;

export const MIN_CROP = 4;
const MAX_FIT = 4;

export function fitScale(image: ImageSize, box: ImageSize): number {
  if (image.width < 1 || image.height < 1 || box.width < 1 || box.height < 1) return 1;
  return Math.min(box.width / image.width, box.height / image.height, MAX_FIT);
}

export function rotatedSize(size: ImageSize): ImageSize {
  return { width: size.height, height: size.width };
}

export function toImagePoint(client: ImagePoint, stage: ImageRect, image: ImageSize): ImagePoint {
  const scaleX = stage.width > 0 ? image.width / stage.width : 1;
  const scaleY = stage.height > 0 ? image.height / stage.height : 1;
  const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
  return { x: clamp((client.x - stage.x) * scaleX, image.width), y: clamp((client.y - stage.y) * scaleY, image.height) };
}

export function cropRect(from: ImagePoint, to: ImagePoint, image: ImageSize): ImageRect | null {
  const left = Math.max(0, Math.floor(Math.min(from.x, to.x)));
  const top = Math.max(0, Math.floor(Math.min(from.y, to.y)));
  const right = Math.min(image.width, Math.ceil(Math.max(from.x, to.x)));
  const bottom = Math.min(image.height, Math.ceil(Math.max(from.y, to.y)));
  const width = right - left;
  const height = bottom - top;
  if (width < MIN_CROP || height < MIN_CROP) return null;
  if (width === image.width && height === image.height) return null;
  return { x: left, y: top, width, height };
}

export type ImageEditKey = "save" | "save-as-new" | "undo" | "redo" | "apply" | "escape";

type KeyLike = { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean };

export function imageEditKey(event: KeyLike, mac = isMacOS): ImageEditKey | null {
  if (event.key === "Escape") return "escape";
  if (event.key === "Enter" && !event.ctrlKey && !event.metaKey && !event.altKey) return "apply";
  if (event.altKey || !isPrimaryKey(event, mac)) return null;
  const key = event.key.toLowerCase();
  if (key === "s") return event.shiftKey ? "save-as-new" : "save";
  if (key === "z") return event.shiftKey ? "redo" : "undo";
  if (key === "y" && !mac) return "redo";
  return null;
}
