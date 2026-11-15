export function visibleRows(count: number, rowHeight: number, scrollTop: number, viewport: number, overscan: number) {
  if (count === 0 || rowHeight <= 0) return { start: 0, end: 0 };
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(count, Math.ceil((scrollTop + viewport) / rowHeight) + overscan);
  return { start: Math.min(start, end), end };
}
