export function webLink(text: string): string | null {
  const trimmed = text.trim();
  if (!/^https?:\/\/\S+$/i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}

export function sameSelection(a: { x: number; y: number; width: number; height: number } | null, b: { x: number; y: number; width: number; height: number } | null): boolean {
  return a === b || (a !== null && b !== null && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height);
}
