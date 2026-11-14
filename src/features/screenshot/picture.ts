import { edgesAround, type Edges } from "./measure.ts";
import { hexColor, type Point } from "./selection.ts";

export type Picture = { id: number; width: number; height: number; data: Uint8ClampedArray };

function inside(picture: Picture, pixel: Point): boolean {
  return pixel.x >= 0 && pixel.y >= 0 && pixel.x < picture.width && pixel.y < picture.height && picture.data.length >= picture.width * picture.height * 4;
}

export function colorAt(picture: Picture, pixel: Point): string {
  if (!inside(picture, pixel)) return "#000000";
  const at = (pixel.y * picture.width + pixel.x) * 4;
  return hexColor(picture.data[at], picture.data[at + 1], picture.data[at + 2]);
}

export function edgesIn(picture: Picture, pixel: Point): Edges | null {
  if (!inside(picture, pixel)) return null;
  const stride = picture.width * 4;
  const row = picture.data.subarray(pixel.y * stride, (pixel.y + 1) * stride);
  const column = new Uint8ClampedArray(picture.height * 4);
  for (let y = 0; y < picture.height; y += 1) {
    const from = y * stride + pixel.x * 4;
    column.set(picture.data.subarray(from, from + 4), y * 4);
  }
  return edgesAround(row, column, pixel);
}
