import DOMPurify from "dompurify";

export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const ICON_PNG_SIZE = 96;
export const ZOOM_RANGE = { min: 0.4, max: 4 };
export const clampZoom = (zoom: number) => Math.min(ZOOM_RANGE.max, Math.max(ZOOM_RANGE.min, zoom));

export type ImageShape = "none" | "circle" | "round";
export type ImportError = "badType" | "tooBig" | "unreadable";
export type ImportedImage = { image: HTMLImageElement; kind: "svg" | "alpha" | "photo" };
export type CropState = { zoom: number; dx: number; dy: number; shape: ImageShape; cover: boolean };

const TYPES = new Set(["image/svg+xml", "image/png", "image/jpeg", "image/webp", "image/gif"]);

export const looksLikeSvg = (text: string) => /^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(text);

export function svgBlob(markup: string): Blob {
  const withNs = /xmlns=/.test(markup) ? markup : markup.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return new Blob([withNs], { type: "image/svg+xml" });
}

async function cleanBlob(blob: Blob): Promise<Blob> {
  if (blob.type !== "image/svg+xml") return blob;
  const clean = DOMPurify.sanitize(await blob.text(), { USE_PROFILES: { svg: true, svgFilters: true } });
  return svgBlob(clean);
}

function hasAlpha(image: HTMLImageElement): boolean {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 24;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return false;
  context.drawImage(image, 0, 0, 24, 24);
  const pixels = context.getImageData(0, 0, 24, 24).data;
  for (let index = 3; index < pixels.length; index += 4) if (pixels[index] < 250) return true;
  return false;
}

export async function importImage(blob: Blob): Promise<ImportedImage | ImportError> {
  if (!TYPES.has(blob.type)) return "badType";
  if (blob.size > IMAGE_MAX_BYTES) return "tooBig";
  let url = "";
  try {
    url = URL.createObjectURL(await cleanBlob(blob));
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    if (!image.naturalWidth && blob.type !== "image/svg+xml") throw new Error("empty");
    return { image, kind: blob.type === "image/svg+xml" ? "svg" : hasAlpha(image) ? "alpha" : "photo" };
  } catch {
    return "unreadable";
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

export function initialCrop(kind: ImportedImage["kind"]): CropState {
  return kind === "photo" ? { zoom: 1, dx: 0, dy: 0, shape: "circle", cover: true } : { zoom: 0.86, dx: 0, dy: 0, shape: "none", cover: false };
}

function clip(context: CanvasRenderingContext2D, size: number, shape: ImageShape) {
  if (shape === "none") return;
  context.beginPath();
  if (shape === "circle") context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  else context.roundRect(0, 0, size, size, size * 0.24);
  context.clip();
}

export function paintCrop(context: CanvasRenderingContext2D, size: number, image: HTMLImageElement, crop: CropState) {
  context.clearRect(0, 0, size, size);
  context.save();
  clip(context, size, crop.shape);
  const width = image.naturalWidth || size;
  const height = image.naturalHeight || size;
  const fit = (crop.cover ? Math.max : Math.min)(size / width, size / height) * crop.zoom;
  const drawWidth = width * fit;
  const drawHeight = height * fit;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, (size - drawWidth) / 2 + crop.dx * size, (size - drawHeight) / 2 + crop.dy * size, drawWidth, drawHeight);
  context.restore();
}

export function renderIconPng(image: HTMLImageElement, crop: CropState): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = ICON_PNG_SIZE;
  const context = canvas.getContext("2d");
  if (!context) return null;
  paintCrop(context, ICON_PNG_SIZE, image, crop);
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

export function clipboardImage(data: DataTransfer | null): Blob | string | null {
  if (!data) return null;
  for (const item of Array.from(data.items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) return item.getAsFile();
  }
  const text = data.getData("text/plain");
  return looksLikeSvg(text) ? text : null;
}
