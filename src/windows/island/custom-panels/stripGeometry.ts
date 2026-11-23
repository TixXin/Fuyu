import { cellsToPx, GRID_CELL_PX, GRID_GAP_PX, layoutStrip, sizeCells, stripRightPx, type CustomPanel } from "../../../lib/settings/customPanels.ts";
import { FUYU_BOARD_TOP_PX, FUYU_COLUMNS, FUYU_ROWS } from "./panelSize.ts";

export const STRIP_STEP_PX = GRID_CELL_PX + GRID_GAP_PX;
export const MIN_CELL_SCALE = 0.85;
export const MAX_CELL_SCALE = 1.2;
export const MAX_GRID_ROWS = 6;

export type StripRoom = { width: number; height: number };
type Grid = { columns: number; rows: number; scale: number };

const fitting = (px: number) => Math.floor((px + GRID_GAP_PX) / STRIP_STEP_PX);

function needs(panel: CustomPanel) {
  return panel.items.reduce((least, item) => {
    const cells = sizeCells(item.size);
    return { columns: Math.max(least.columns, cells.cols), rows: Math.max(least.rows, cells.rows) };
  }, { columns: 2, rows: 1 });
}

const MAX_GRID_COLUMNS = 16;

function scored(room: StripRoom, columns: number, rows: number) {
  const tall = cellsToPx(rows) + FUYU_BOARD_TOP_PX;
  const scale = Math.min(MAX_CELL_SCALE, room.width / cellsToPx(columns), room.height / tall);
  const fill = (cellsToPx(columns) * scale * tall * scale) / Math.max(1, room.width * room.height);
  return { columns, rows, scale, score: fill - Math.abs(1 - scale) };
}

export function gridFor(room: StripRoom, least: { columns: number; rows: number }): Grid {
  let best = scored(room, least.columns, least.rows);
  for (let columns = least.columns; columns <= MAX_GRID_COLUMNS; columns += 1) {
    for (let rows = least.rows; rows <= MAX_GRID_ROWS; rows += 1) {
      const option = scored(room, columns, rows);
      if (option.scale >= MIN_CELL_SCALE && (best.scale < MIN_CELL_SCALE || option.score > best.score)) best = option;
    }
  }
  return { columns: best.columns, rows: best.rows, scale: best.scale > 0 ? best.scale : 1 };
}

function freeGeometry(stored: CustomPanel, room: StripRoom | null, editing: boolean) {
  const height = cellsToPx(FUYU_ROWS);
  const scale = room ? Math.min(1, room.width / cellsToPx(FUYU_COLUMNS), room.height / (height + FUYU_BOARD_TOP_PX)) : 1;
  const fit = scale > 0 ? scale : 1;
  const visible = room ? room.width / fit : cellsToPx(FUYU_COLUMNS);
  const pageColumns = Math.max(1, fitting(visible));
  const width = Math.max(visible, stripRightPx(stored) + (editing ? STRIP_STEP_PX : 0));
  return { scale: fit, width, height, rows: FUYU_ROWS, panel: stored, pages: 0, pageColumns, pageStepPx: pageColumns * STRIP_STEP_PX };
}

export function stripGeometry(stored: CustomPanel, room: StripRoom | null, editing: boolean) {
  if (stored.mode === "free") return freeGeometry(stored, room, editing);
  const grid = room ? gridFor(room, needs(stored)) : { columns: FUYU_COLUMNS, rows: FUYU_ROWS, scale: 1 };
  const pageColumns = grid.columns;
  const panel = layoutStrip(stored, grid.rows, pageColumns);
  const right = stripRightPx(panel);
  const paged = panel.items.length > 0;
  const columns = Math.max(pageColumns, Math.ceil((right + GRID_GAP_PX) / STRIP_STEP_PX) + (editing && !paged ? 1 : 0));
  const pages = paged ? Math.ceil(columns / pageColumns) : 0;
  const width = cellsToPx(paged ? pages * pageColumns : columns);
  return { scale: grid.scale, width, height: cellsToPx(grid.rows), rows: grid.rows, panel, pages, pageColumns, pageStepPx: pageColumns * STRIP_STEP_PX };
}
