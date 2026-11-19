const SVG_DATA = /^data:image\/svg\+xml((?:;[^,]*)?),([\s\S]*)$/i;
const FIRST_RECT_FILL = /<rect\b[^>]*?\sfill=["'](#[0-9a-f]{6}|#[0-9a-f]{3})["']/i;
const STRIP_RATIO = 3.4;

export function iconTint(src: string | null | undefined): string | null {
  const match = src ? SVG_DATA.exec(src) : null;
  if (!match) return null;
  try {
    const svg = /;base64/i.test(match[1]) ? atob(match[2]) : decodeURIComponent(match[2]);
    return FIRST_RECT_FILL.exec(svg)?.[1].toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export function isStripShot(width: number, height: number): boolean {
  return width > 0 && height > 0 && width / height > STRIP_RATIO;
}
