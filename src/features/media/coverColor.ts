import { isLightIsland, relativeLuminance } from "../../utils/color.ts";
import { THEME_COLORS } from "../../lib/theme/themeMode.ts";

export const COVER_MIN_CONTRAST = 3;
export const COVER_SAMPLE_SIZE = 32;

type Rgb = [number, number, number];
type Hsl = [number, number, number];

const HUE_BUCKETS = 12;
const MIN_WEIGHT_SHARE = 0.01;

export function hexToRgb(hex: string): Rgb {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)) as Rgb;
}

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((value) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0")).join("")}`;
}

function rgbToHsl([r, g, b]: Rgb): Hsl {
  const [red, green, blue] = [r / 255, g / 255, b / 255];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const chroma = max - min;
  if (chroma === 0) return [0, 0, lightness];
  const saturation = chroma / (1 - Math.abs(2 * lightness - 1));
  const hue = max === red ? ((green - blue) / chroma + 6) % 6 : max === green ? (blue - red) / chroma + 2 : (red - green) / chroma + 4;
  return [hue * 60, saturation, lightness];
}

function hslToRgb([hue, saturation, lightness]: Hsl): Rgb {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - chroma / 2;
  const sector = Math.floor(hue / 60) % 6;
  const [r, g, b] = [[chroma, x, 0], [x, chroma, 0], [0, chroma, x], [0, x, chroma], [x, 0, chroma], [chroma, 0, x]][sector];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

export function contrastRatio(first: string, second: string): number {
  const [light, dark] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

export function pickCoverColor(pixels: ArrayLike<number>): string | null {
  const buckets = Array.from({ length: HUE_BUCKETS }, () => ({ weight: 0, r: 0, g: 0, b: 0 }));
  let total = 0;
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    if (pixels[index + 3] < 128) continue;
    total += 1;
    const rgb: Rgb = [pixels[index], pixels[index + 1], pixels[index + 2]];
    const max = Math.max(...rgb);
    const min = Math.min(...rgb);
    if (max < 40 || min > 225 || max - min < 36) continue;
    const [hue, saturation] = rgbToHsl(rgb);
    if (saturation < 0.25) continue;
    const bucket = buckets[Math.floor(hue / (360 / HUE_BUCKETS)) % HUE_BUCKETS];
    const weight = saturation * (max - min) / 255;
    bucket.weight += weight;
    bucket.r += rgb[0] * weight;
    bucket.g += rgb[1] * weight;
    bucket.b += rgb[2] * weight;
  }
  const best = buckets.reduce((top, bucket) => (bucket.weight > top.weight ? bucket : top));
  if (total === 0 || best.weight < total * MIN_WEIGHT_SHARE) return null;
  return rgbToHex([best.r / best.weight, best.g / best.weight, best.b / best.weight]);
}

export function readableOn(color: string, background: string, minimum = COVER_MIN_CONTRAST): string {
  if (contrastRatio(color, background) >= minimum) return color;
  const [hue, saturation, lightness] = rgbToHsl(hexToRgb(color));
  const lighter = !isLightIsland(background);
  let near = lightness;
  let far = lighter ? 1 : 0;
  if (contrastRatio(rgbToHex(hslToRgb([hue, saturation, far])), background) < minimum) return lighter ? "#ffffff" : "#000000";
  for (let step = 0; step < 24; step += 1) {
    const middle = (near + far) / 2;
    if (contrastRatio(rgbToHex(hslToRgb([hue, saturation, middle])), background) >= minimum) far = middle;
    else near = middle;
  }
  return rgbToHex(hslToRgb([hue, saturation, far]));
}

export type CoverAccents = { dark: string; light: string };

export function coverAccents(color: string, islandBackground: string): CoverAccents {
  const lightIsland = isLightIsland(islandBackground);
  return {
    dark: readableOn(color, lightIsland ? THEME_COLORS.dark.islandBackgroundColor : islandBackground),
    light: readableOn(color, lightIsland ? islandBackground : THEME_COLORS.light.islandBackgroundColor),
  };
}
