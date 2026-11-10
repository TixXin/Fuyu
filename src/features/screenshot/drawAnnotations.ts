// Drawing annotations (annotations.ts) with the 2D canvas API, on the overlay's layer and when the
// selection is composed for copying. Coordinates are the monitor picture's pixels.

import { arrowGeometry, mosaicBlock, normalizedRect, type Annotation } from "./annotations";
import type { PixelRect } from "./selection";

export const ANNOTATION_FONT = '"Microsoft YaHei UI", "Segoe UI", sans-serif';
/** Line height of text annotations, times their size. */
export const TEXT_LINE_HEIGHT = 1.3;
const HIGHLIGHTER_ALPHA = 0.38;

function strokePath(context: CanvasRenderingContext2D, points: readonly { x: number; y: number }[]) {
  context.beginPath();
  points.forEach((point, index) => (index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y)));
  context.stroke();
}

/** Blocks of `picture` averaged over `rect` (scaled down with smoothing, back up without). */
function drawMosaic(context: CanvasRenderingContext2D, picture: CanvasImageSource, rect: PixelRect, block: number) {
  const x = Math.round(rect.x);
  const y = Math.round(rect.y);
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  if (width < 1 || height < 1) return;
  const small = document.createElement("canvas");
  small.width = Math.max(1, Math.ceil(width / block));
  small.height = Math.max(1, Math.ceil(height / block));
  const shrink = small.getContext("2d");
  if (!shrink) return;
  shrink.imageSmoothingEnabled = true;
  shrink.imageSmoothingQuality = "high";
  shrink.drawImage(picture, x, y, width, height, 0, 0, small.width, small.height);
  context.save();
  context.imageSmoothingEnabled = false;
  context.drawImage(small, 0, 0, small.width, small.height, x, y, width, height);
  context.restore();
}

function drawOne(context: CanvasRenderingContext2D, item: Annotation, picture: CanvasImageSource | null) {
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  switch (item.kind) {
    case "rect": {
      const rect = normalizedRect(item.from, item.to);
      context.strokeStyle = item.color;
      context.lineWidth = item.width;
      context.strokeRect(rect.x, rect.y, rect.width, rect.height);
      break;
    }
    case "ellipse": {
      const rect = normalizedRect(item.from, item.to);
      context.strokeStyle = item.color;
      context.lineWidth = item.width;
      context.beginPath();
      context.ellipse(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width / 2, rect.height / 2, 0, 0, Math.PI * 2);
      context.stroke();
      break;
    }
    case "arrow": {
      const { tip, left, right, base } = arrowGeometry(item.from, item.to, item.width);
      context.strokeStyle = item.color;
      context.fillStyle = item.color;
      context.lineWidth = item.width;
      strokePath(context, [item.from, base]);
      context.beginPath();
      context.moveTo(tip.x, tip.y);
      context.lineTo(left.x, left.y);
      context.lineTo(right.x, right.y);
      context.closePath();
      context.fill();
      break;
    }
    case "pen":
    case "highlighter":
      context.strokeStyle = item.color;
      context.lineWidth = item.width;
      // One path, so overlapping parts of a highlighter stroke do not get darker.
      if (item.kind === "highlighter") context.globalAlpha = HIGHLIGHTER_ALPHA;
      strokePath(context, item.points);
      break;
    case "mosaic":
      if (picture) drawMosaic(context, picture, normalizedRect(item.from, item.to), mosaicBlock(item.width));
      break;
    case "text":
      context.fillStyle = item.color;
      context.font = `600 ${item.size}px ${ANNOTATION_FONT}`;
      context.textBaseline = "top";
      item.text.split("\n").forEach((line, index) => context.fillText(line, item.at.x, item.at.y + index * item.size * TEXT_LINE_HEIGHT));
      break;
    case "number": {
      context.fillStyle = item.color;
      context.beginPath();
      context.arc(item.at.x, item.at.y, item.size, 0, Math.PI * 2);
      context.fill();
      // Dark digits on the light swatches, white on the rest.
      context.fillStyle = item.color === "#FFFFFF" || item.color === "#FFCC00" ? "#000000" : "#FFFFFF";
      context.font = `700 ${item.size * 1.1}px ${ANNOTATION_FONT}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(item.value), item.at.x, item.at.y + item.size * 0.06);
      break;
    }
  }
  context.restore();
}

/** Draws `items` in order, clipped to `clip`; mosaics are made from `picture`. */
export function drawAnnotations(
  context: CanvasRenderingContext2D,
  items: readonly Annotation[],
  picture: CanvasImageSource | null,
  clip: PixelRect | null,
) {
  context.save();
  if (clip) {
    context.beginPath();
    context.rect(clip.x, clip.y, clip.width, clip.height);
    context.clip();
  }
  for (const item of items) drawOne(context, item, picture);
  context.restore();
}

/** The selection of `picture` with `items` drawn on it, as RGBA pixels; null when it cannot be drawn. */
export function composeSelection(picture: HTMLCanvasElement, selection: PixelRect, items: readonly Annotation[]): ImageData | null {
  const canvas = document.createElement("canvas");
  canvas.width = selection.width;
  canvas.height = selection.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || selection.width < 1 || selection.height < 1) return null;
  context.translate(-selection.x, -selection.y);
  context.drawImage(picture, 0, 0);
  drawAnnotations(context, items, picture, selection);
  return context.getImageData(0, 0, selection.width, selection.height);
}
