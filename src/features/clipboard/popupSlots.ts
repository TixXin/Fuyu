export type PopupSlotSizes = { row: number; section: number; divider: number; gap: number };

export const DEFAULT_POPUP_SLOT_SIZES: PopupSlotSizes = { row: 44, section: 21, divider: 9, gap: 1 };

export function popupSlotOffsets(count: number, pinned: number, hasHeading: (index: number) => boolean, sizes: PopupSlotSizes) {
  const offsets = [0];
  for (let index = 0; index < count; index += 1) {
    let height = sizes.row + sizes.gap;
    if (pinned > 0 && index === pinned) height += sizes.divider + sizes.gap;
    if (hasHeading(index)) height += sizes.section + sizes.gap;
    offsets.push(offsets[index] + height);
  }
  return offsets;
}

export function skippedHeight(offsets: readonly number[], from: number, to: number, gap: number) {
  return to > from ? Math.max(0, offsets[to] - offsets[from] - gap) : 0;
}

export function sameSlotSizes(a: PopupSlotSizes, b: PopupSlotSizes) {
  return a.row === b.row && a.section === b.section && a.divider === b.divider && a.gap === b.gap;
}
