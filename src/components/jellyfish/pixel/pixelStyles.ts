import type { JellyfishStyle } from "../../../lib/settings/types";
import type { PixelGridKey } from "./pixelGrids.ts";
import type { PixelPaint } from "./pixelTones.ts";

export type PixelJellyfishStyle = Exclude<JellyfishStyle, "vector">;

export const PIXEL_STYLES: Record<PixelJellyfishStyle, { paint: PixelPaint; grids: readonly PixelGridKey[] }> = {
  flat: { paint: "flat", grids: ["M", "S"] },
  sticker: { paint: "sticker", grids: ["M", "S"] },
  mono: { paint: "mono", grids: ["M", "S"] },
  neon: { paint: "neon", grids: ["M", "S"] },
  chunky: { paint: "flat", grids: ["S"] },
  fine: { paint: "fine", grids: ["L", "M", "S"] },
};
