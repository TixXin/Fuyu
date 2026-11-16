import { ISLAND_SIDE_COVER_HEIGHT, ISLAND_SIDE_ROW_HEIGHT } from "../../features/plugin-kernel/islandContributions.ts";

export const SIDE_COLUMN_WIDTH = 44;
export const SIDE_ROW_HEIGHT = ISLAND_SIDE_ROW_HEIGHT;
export const SIDE_COVER_HEIGHT = ISLAND_SIDE_COVER_HEIGHT;
export const SIDE_ROW_GAP = 6;
export const SIDE_COLUMN_PADDING = 10;
export const SIDE_COLUMN_MAX_HEIGHT = 300;
export const SIDE_BUBBLE_HEIGHT = 38;

export type SideRow = { id: string; height: number };

export type SideColumnLayout<T extends SideRow> = {
  shown: T[];
  hidden: number;
  height: number;
  offsets: number[];
};

function heightOf(rows: readonly { height: number }[]) {
  if (rows.length === 0) return SIDE_COLUMN_PADDING * 2 + SIDE_ROW_HEIGHT;
  return SIDE_COLUMN_PADDING * 2 + rows.reduce((sum, row) => sum + row.height, 0) + SIDE_ROW_GAP * (rows.length - 1);
}

function offsetsOf(rows: readonly { height: number }[]) {
  let top = SIDE_COLUMN_PADDING;
  return rows.map((row) => {
    const offset = top;
    top += row.height + SIDE_ROW_GAP;
    return offset;
  });
}

export function layoutSideColumn<T extends SideRow>(rows: readonly T[], maxHeight = SIDE_COLUMN_MAX_HEIGHT): SideColumnLayout<T> {
  if (heightOf(rows) <= maxHeight) {
    return { shown: [...rows], hidden: 0, height: heightOf(rows), offsets: offsetsOf(rows) };
  }
  const more = { height: SIDE_ROW_HEIGHT };
  let shown = rows.slice(0, 1);
  for (let count = rows.length - 1; count >= 1; count -= 1) {
    if (heightOf([...rows.slice(0, count), more]) <= maxHeight) {
      shown = rows.slice(0, count);
      break;
    }
  }
  const withMore = [...shown, more];
  return { shown, hidden: rows.length - shown.length, height: heightOf(withMore), offsets: offsetsOf(withMore) };
}

export function sideBubbleTop(columnHeight: number, rowCenter: number | null, radius: number, bubbleHeight = SIDE_BUBBLE_HEIGHT) {
  const center = rowCenter ?? columnHeight / 2;
  const low = Math.min(radius, Math.max(0, (columnHeight - bubbleHeight) / 2));
  const high = Math.max(low, columnHeight - radius - bubbleHeight);
  return Math.round(Math.min(high, Math.max(low, center - bubbleHeight / 2)));
}
