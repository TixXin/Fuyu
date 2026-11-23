import type { PixelEffectSize } from "./pixelGrids.ts";
import type { Rgb } from "./pixelTones.ts";

export type PixelEffectName = "bang" | "anger" | "spark" | "sparkSmall";
export type PixelSprite = readonly string[];

const DOT = ["#"];
const BLOCK = ["##", "##"];
const PLUS3 = [".#.", "###", ".#."];
const PLUS5 = ["..#..", "..#..", "#####", "..#..", "..#.."];
const PLUS9 = ["....#....", "....#....", "....#....", "...###...", "#########", "...###...", "....#....", "....#....", "....#...."];
const VEIN3 = ["#.#", "...", "#.#"];
const VEIN5 = [".#.#.", "##.##", ".....", "##.##", ".#.#."];
const VEIN9 = ["..#...#..", "..#...#..", "###...###", ".........", ".........", ".........", "###...###", "..#...#..", "..#...#.."];

export const PIXEL_EFFECTS: Record<PixelEffectName, { color: Rgb; sprites: Record<PixelEffectSize, readonly PixelSprite[]> }> = {
  bang: {
    color: [255, 200, 31],
    sprites: { s: [["#", "#", ".", "#"]], m: [["#", "#", "#", ".", "#"]], l: [["##", "##", "##", "##", "##", "..", "##", "##"]] },
  },
  anger: { color: [255, 74, 61], sprites: { s: [DOT, VEIN3], m: [DOT, VEIN3, VEIN5], l: [BLOCK, VEIN5, VEIN9] } },
  spark: { color: [255, 210, 63], sprites: { s: [DOT, PLUS3], m: [DOT, PLUS3, PLUS5], l: [BLOCK, PLUS5, PLUS9] } },
  sparkSmall: { color: [255, 210, 63], sprites: { s: [DOT], m: [DOT, PLUS3], l: [DOT, PLUS3, PLUS5] } },
};

export function effectSprite(name: PixelEffectName, size: PixelEffectSize, level: number): { sprite: PixelSprite; box: PixelSprite } {
  const sprites = PIXEL_EFFECTS[name].sprites[size];
  const box = sprites[sprites.length - 1];
  return { sprite: sprites[Math.floor((level * (sprites.length - 1)) / 2)] ?? box, box };
}
