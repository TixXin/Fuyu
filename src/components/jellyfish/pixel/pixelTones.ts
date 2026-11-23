export type Rgb = readonly [number, number, number];
export type PixelPaint = "flat" | "sticker" | "mono" | "neon" | "fine";
export type PixelTones = {
  base: Rgb;
  hi: Rgb;
  sh: Rgb;
  sh2: Rgb;
  outline: Rgb;
  ink: Rgb;
  cheek: Rgb;
  tongue: Rgb;
  rim: Rgb | null;
};

const WHITE: Rgb = [255, 255, 255];
const INK: Rgb = [29, 27, 34];
const CHEEK: Rgb = [255, 143, 160];
const TONGUE: Rgb = [255, 107, 122];
const SHADE: Rgb = [67, 48, 122];
const DEEP_SHADE: Rgb = [44, 29, 92];
const OUTLINE: Rgb = [21, 15, 34];
const PALE_LINE: Rgb = [184, 159, 130];
const PALE_RIM: Rgb = [180, 157, 130];

export function mixRgb(from: Rgb, to: Rgb, amount: number): Rgb {
  return [0, 1, 2].map((i) => Math.round(from[i] + (to[i] - from[i]) * amount)) as unknown as Rgb;
}

export function sameRgb(a: Rgb, b: Rgb): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

export function parseRgb(color: string): Rgb | null {
  const parts = color.match(/-?\d+(\.\d+)?/g);
  if (!parts || parts.length < 3) return null;
  const channels = parts.slice(0, 3).map((part) => Math.min(255, Math.max(0, Math.round(Number(part)))));
  return [channels[0], channels[1], channels[2]];
}

export function pixelTones(paint: PixelPaint, fill: Rgb, light: boolean, pale: boolean): PixelTones {
  const thin = paint === "mono" || paint === "neon";
  let base = fill;
  if (thin && pale) base = PALE_LINE;
  else if (thin && light) base = mixRgb(fill, INK, 0.18);
  else if (paint === "neon") base = mixRgb(fill, WHITE, 0.12);
  return {
    base,
    hi: mixRgb(base, WHITE, 0.62),
    sh: mixRgb(base, SHADE, 0.22),
    sh2: mixRgb(base, DEEP_SHADE, 0.42),
    outline: mixRgb(base, OUTLINE, 0.68),
    ink: INK,
    cheek: CHEEK,
    tongue: TONGUE,
    rim: pale && (paint === "flat" || paint === "fine") ? PALE_RIM : null,
  };
}
