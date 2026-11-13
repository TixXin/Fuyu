export function toggleQueued(queue: readonly string[], id: string): string[] {
  return queue.includes(id) ? queue.filter((queued) => queued !== id) : [...queue, id];
}

export function popupIndexAfterKey(key: string, current: number, count: number, digitsPaste: boolean): { index: number; paste: boolean } | null {
  if (count === 0) return null;
  if (digitsPaste && /^[1-9]$/.test(key)) {
    const index = Number(key) - 1;
    return index < count ? { index, paste: true } : null;
  }
  switch (key) {
    case "ArrowDown":
      return { index: (current + 1) % count, paste: false };
    case "ArrowUp":
      return { index: (current - 1 + count) % count, paste: false };
    case "Home":
      return { index: 0, paste: false };
    case "End":
      return { index: count - 1, paste: false };
    default:
      return null;
  }
}

export const PEEK_HOLD_MS = 350;

export function releaseEndsPeek(heldMs: number): boolean {
  return heldMs >= PEEK_HOLD_MS;
}
