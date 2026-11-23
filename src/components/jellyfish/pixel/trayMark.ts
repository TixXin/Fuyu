import { composePixelJellyfish } from "./pixelCompose.ts";
import { PIXEL_GRIDS } from "./pixelGrids.ts";
import { stillPose } from "./pixelPoses.ts";
import { PIXEL_STYLES, type PixelJellyfishStyle } from "./pixelStyles.ts";
import { pixelTones } from "./pixelTones.ts";

export const TRAY_MARK_WIDTH = 52;
export const TRAY_MARK_HEIGHT = 36;

export function trayMarkAlpha(style: PixelJellyfishStyle): number[] {
  const spec = PIXEL_STYLES[style];
  const fits = spec.grids.map((key) => {
    const grid = PIXEL_GRIDS[key];
    return { grid, cell: Math.floor(Math.min(TRAY_MARK_WIDTH / grid.width, TRAY_MARK_HEIGHT / grid.height)) };
  });
  const { grid, cell } = fits.reduce((best, next) => (next.cell * next.grid.height > best.cell * best.grid.height ? next : best));
  const paint = spec.paint === "neon" ? "neon" : "mono";
  const buffer = composePixelJellyfish(grid, paint, { ...stillPose("idle"), eyes: "open" }, pixelTones(paint, [0, 0, 0], true, false));
  const alpha = new Array<number>(TRAY_MARK_WIDTH * TRAY_MARK_HEIGHT).fill(0);
  const left = Math.floor((TRAY_MARK_WIDTH - grid.width * cell) / 2);
  const top = Math.floor((TRAY_MARK_HEIGHT - grid.height * cell) / 2);
  const drawn = (x: number, y: number) => buffer.data[((buffer.originY + y) * buffer.width + buffer.originX + x) * 4 + 3];
  const cheeks = new Set(grid.cheeks.flatMap(([x, y]) => [y * grid.width + x, y * grid.width + grid.width - 1 - x]));
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const value = cheeks.has(y * grid.width + x) ? drawn(x, y - 1) : drawn(x, y);
      if (!value) continue;
      for (let dy = 0; dy < cell; dy += 1) alpha.fill(value, (top + y * cell + dy) * TRAY_MARK_WIDTH + left + x * cell, (top + y * cell + dy) * TRAY_MARK_WIDTH + left + (x + 1) * cell);
    }
  }
  return alpha;
}
