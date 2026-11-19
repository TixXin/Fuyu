import type { GlassFallbackReason } from "./glassStatus";

const HEADER = 24;
const FAILURES: Record<number, GlassFallbackReason> = { 1: "unsupported", 2: "no-d3d", 3: "remote", 4: "failed" };

export type GlassFrame = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  pixels: Uint8ClampedArray<ArrayBuffer>;
};

export type GlassMessage =
  | { kind: "frame"; frame: GlassFrame }
  | { kind: "failed"; reason: GlassFallbackReason }
  | { kind: "none" };

export type ViewBox = { left: number; top: number; width: number; height: number };

function toBytes(data: ArrayBuffer | ArrayLike<number>): Uint8Array<ArrayBuffer> {
  return data instanceof ArrayBuffer ? new Uint8Array(data) : Uint8Array.from(data);
}

export function parseGlassMessage(data: ArrayBuffer | ArrayLike<number>): GlassMessage {
  const bytes = toBytes(data);
  if (bytes.byteLength === 1) return { kind: "failed", reason: FAILURES[bytes[0]] ?? "failed" };
  if (bytes.byteLength < HEADER) return { kind: "none" };
  const view = new DataView(bytes.buffer, bytes.byteOffset, HEADER);
  const width = view.getUint32(16, true);
  const height = view.getUint32(20, true);
  if (width === 0 || height === 0 || bytes.byteLength < HEADER + width * height * 4) return { kind: "none" };
  return {
    kind: "frame",
    frame: {
      left: view.getInt32(0, true),
      top: view.getInt32(4, true),
      right: view.getInt32(8, true),
      bottom: view.getInt32(12, true),
      width,
      height,
      pixels: new Uint8ClampedArray(bytes.buffer, bytes.byteOffset + HEADER, width * height * 4),
    },
  };
}

function ratioOf(scale: number) {
  return scale > 0 && Number.isFinite(scale) ? scale : 1;
}

const round = (value: number) => Math.round(value * 100) / 100;

export function glassFramePlacement(frame: GlassFrame, scale: number, island: ViewBox): ViewBox {
  const ratio = ratioOf(scale);
  return {
    left: round(frame.left / ratio - island.left),
    top: round(frame.top / ratio - island.top),
    width: round((frame.right - frame.left) / ratio),
    height: round((frame.bottom - frame.top) / ratio),
  };
}

const linear = (channel: number) => (channel / 255) ** 2.2;

export function frameLuminance(frame: GlassFrame, scale: number, island: ViewBox): number | null {
  const ratio = ratioOf(scale);
  const spanX = frame.right - frame.left;
  const spanY = frame.bottom - frame.top;
  if (spanX <= 0 || spanY <= 0) return null;
  const column = (value: number) => Math.min(frame.width, Math.max(0, Math.round(((value * ratio - frame.left) / spanX) * frame.width)));
  const row = (value: number) => Math.min(frame.height, Math.max(0, Math.round(((value * ratio - frame.top) / spanY) * frame.height)));
  const [x0, x1] = [column(island.left), column(island.left + island.width)];
  const [y0, y1] = [row(island.top), row(island.top + island.height)];
  const step = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 400)));
  let total = 0;
  let count = 0;
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const index = (y * frame.width + x) * 4;
      total += 0.2126 * linear(frame.pixels[index]) + 0.7152 * linear(frame.pixels[index + 1]) + 0.0722 * linear(frame.pixels[index + 2]);
      count += 1;
    }
  }
  return count ? total / count : null;
}
