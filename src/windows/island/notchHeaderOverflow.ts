export const NOTCH_TAB_WIDTH = 28;
export const NOTCH_TEXT_TAB_ESTIMATE = 54;
export const NOTCH_MORE_WIDTH = 42;
export const NOTCH_TAB_GAP = 2;

export function splitNotchHeaderTabs(
  availableWidth: number,
  itemWidths: readonly number[],
  moreWidth = NOTCH_MORE_WIDTH,
  gap = NOTCH_TAB_GAP,
): number {
  if (itemWidths.length === 0) return 0;
  if (!(availableWidth > 0)) return itemWidths.length;
  const total = itemWidths.reduce((sum, width) => sum + width, 0) + Math.max(0, itemWidths.length - 1) * gap;
  if (total <= availableWidth + 0.5) return itemWidths.length;
  let used = 0;
  let count = 0;
  for (let index = 0; index < itemWidths.length; index += 1) {
    const nextUsed = used + (index > 0 ? gap : 0) + itemWidths[index];
    if (nextUsed + gap + moreWidth <= availableWidth + 0.5) {
      used = nextUsed;
      count = index + 1;
    } else {
      break;
    }
  }
  return count;
}
