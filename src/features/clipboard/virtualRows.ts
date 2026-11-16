export function visibleRows(count: number, rowHeight: number, scrollTop: number, viewport: number, overscan: number) {
  if (count === 0 || rowHeight <= 0) return { start: 0, end: 0 };
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(count, Math.ceil((scrollTop + viewport) / rowHeight) + overscan);
  return { start: Math.min(start, end), end };
}

export function visibleSlots(offsets: readonly number[], scrollTop: number, viewport: number, overscan: number) {
  const count = offsets.length - 1;
  if (count <= 0) return { start: 0, end: 0 };
  const first = slotAt(offsets, scrollTop);
  const last = slotAt(offsets, scrollTop + viewport);
  return { start: Math.max(0, first - overscan), end: Math.min(count, last + 1 + overscan) };
}

function slotAt(offsets: readonly number[], y: number) {
  let low = 0;
  let high = offsets.length - 2;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (offsets[middle] <= y) low = middle;
    else high = middle - 1;
  }
  return low;
}
