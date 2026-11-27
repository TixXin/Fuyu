export const HEADER_TAB_WIDTH = 34;
export const HEADER_TEXT_TAB_ESTIMATE = 60;
export const HEADER_MORE_WIDTH = 42;
export const HEADER_GAP = 2;

export type HeaderTabFit = {
  compact: boolean;
  visible: number;
};

export type HeaderTabFitInput = {
  available: number;
  split: number;
  full: readonly number[];
  compact: readonly number[];
  fullExtra: number;
  compactExtra: number;
  rowMin: number;
  more: number;
  gap?: number;
};

function neededWidth(widths: readonly number[], count: number, split: number, extra: number, rowMin: number, more: number, gap: number) {
  const titleTabs = widths.slice(0, Math.min(split, count));
  const rowTabs = widths.slice(split, Math.max(split, count));
  const title = Math.max(0, titleTabs.reduce((sum, width) => sum + width + gap, 0) + extra - gap);
  const rowTabsWidth = rowTabs.reduce((sum, width) => sum + width, 0) + Math.max(0, rowTabs.length - 1) * gap;
  const row = rowTabsWidth + (more > 0 ? (rowTabs.length > 0 ? gap : 0) + more : 0);
  return title + Math.max(rowMin, row);
}

export function fitHeaderTabs(input: HeaderTabFitInput): HeaderTabFit {
  const { available, split, full, compact, fullExtra, compactExtra, rowMin, more } = input;
  const gap = input.gap ?? HEADER_GAP;
  const total = full.length;
  if (total === 0 || !(available > 0)) return { compact: false, visible: total };
  const fits = (width: number) => width <= available + 0.5;
  if (fits(neededWidth(full, total, split, fullExtra, rowMin, 0, gap))) return { compact: false, visible: total };
  if (fits(neededWidth(compact, total, split, compactExtra, rowMin, 0, gap))) return { compact: true, visible: total };
  for (let count = total - 1; count > 0; count -= 1) {
    if (fits(neededWidth(compact, count, split, compactExtra, rowMin, more, gap))) return { compact: true, visible: count };
  }
  return { compact: true, visible: 0 };
}
