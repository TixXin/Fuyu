import { arrowGeometry, blurRadius, mosaicBlock, normalizedRect, TEXT_LINE_HEIGHT, type Annotation } from "./annotations";
import type { PixelRect } from "./selection";

export { TEXT_LINE_HEIGHT };
export const ANNOTATION_FONT = '"Microsoft YaHei UI", "Segoe UI", sans-serif';
const HIGHLIGHTER_ALPHA = 0.38;
export const SPOTLIGHT_DIM = "rgba(0, 0, 0, 0.55)";

function strokePath(context: CanvasRenderingContext2D, points: readonly { x: number; y: number }[]) {
  context.beginPath();
  points.forEach((point, index) => (index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y)));
  context.stroke();
}

const mosaicScratch = document.createElement("canvas");

function drawMosaic(context: CanvasRenderingContext2D, picture: CanvasImageSource, rect: PixelRect, block: number) {
  const x = Math.round(rect.x);
  const y = Math.round(rect.y);
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  if (width < 1 || height < 1) return;
  mosaicScratch.width = Math.max(1, Math.ceil(width / block));
  mosaicScratch.height = Math.max(1, Math.ceil(height / block));
  const shrink = mosaicScratch.getContext("2d");
  if (!shrink) return;
  shrink.imageSmoothingEnabled = true;
  shrink.imageSmoothingQuality = "high";
  shrink.drawImage(picture, x, y, width, height, 0, 0, mosaicScratch.width, mosaicScratch.height);
  context.save();
  context.imageSmoothingEnabled = false;
  context.drawImage(mosaicScratch, 0, 0, mosaicScratch.width, mosaicScratch.height, x, y, width, height);
  context.restore();
}

const blurScratch = document.createElement("canvas");

function drawBlur(context: CanvasRenderingContext2D, picture: CanvasImageSource, rect: PixelRect, radius: number) {
  const x = Math.round(rect.x);
  const y = Math.round(rect.y);
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  if (width < 1 || height < 1) return;
  const pad = radius * 2;
  const step = Math.max(2, radius);
  blurScratch.width = Math.max(1, Math.ceil((width + pad * 2) / step));
  blurScratch.height = Math.max(1, Math.ceil((height + pad * 2) / step));
  const shrink = blurScratch.getContext("2d");
  if (!shrink) return;
  shrink.imageSmoothingEnabled = true;
  shrink.imageSmoothingQuality = "high";
  shrink.drawImage(picture, x - pad, y - pad, width + pad * 2, height + pad * 2, 0, 0, blurScratch.width, blurScratch.height);
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(blurScratch, 0, 0, blurScratch.width, blurScratch.height, x - pad, y - pad, width + pad * 2, height + pad * 2);
  context.restore();
}

function drawSpotlights(context: CanvasRenderingContext2D, items: readonly Annotation[], clip: PixelRect | null) {
  const area = clip ?? { x: 0, y: 0, width: context.canvas.width, height: context.canvas.height };
  context.save();
  context.beginPath();
  context.rect(area.x, area.y, area.width, area.height);
  for (const item of items) {
    if (item.kind !== "spotlight") continue;
    const rect = normalizedRect(item.from, item.to);
    context.rect(rect.x, rect.y, rect.width, rect.height);
  }
  context.fillStyle = SPOTLIGHT_DIM;
  context.fill("evenodd");
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
    case "line":
      context.strokeStyle = item.color;
      context.lineWidth = item.width;
      strokePath(context, [item.from, item.to]);
      break;
    case "blur":
      if (picture) drawBlur(context, picture, normalizedRect(item.from, item.to), blurRadius(item.width));
      break;
    case "spotlight":
      break;
    case "pen":
    case "highlighter":
      context.strokeStyle = item.color;
      context.lineWidth = item.width;
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
  const firstSpot = items.findIndex((item) => item.kind === "spotlight");
  items.forEach((item, index) => {
    if (index === firstSpot) drawSpotlights(context, items, clip);
    drawOne(context, item, picture);
  });
  context.restore();
}

export function composeArea(picture: HTMLCanvasElement, area: PixelRect, selection: PixelRect, items: readonly Annotation[]): ImageData | null {
  if (area.width < 1 || area.height < 1) return null;
  const canvas = document.createElement("canvas");
  canvas.width = area.width;
  canvas.height = area.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.translate(-area.x, -area.y);
  context.drawImage(picture, area.x, area.y, area.width, area.height, area.x, area.y, area.width, area.height);
  drawAnnotations(context, items, picture, selection);
  const result = context.getImageData(0, 0, area.width, area.height);
  canvas.width = 0;
  canvas.height = 0;
  return result;
}
