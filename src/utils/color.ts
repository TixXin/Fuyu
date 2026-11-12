export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function getColorSetting(value: unknown, fallback: string) {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value)
    ? value
    : fallback;
}

export function relativeLuminance(hex: string) {
  if (!HEX_COLOR_PATTERN.test(hex)) return 0;
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isLightIsland(background: string) {
  return relativeLuminance(background) > 0.18;
}

export function inkOn(background: string) {
  return relativeLuminance(background) > 0.18 ? "24, 24, 30" : "241, 240, 246";
}
