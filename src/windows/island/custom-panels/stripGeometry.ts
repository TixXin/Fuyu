import { cellsToPx, GRID_CELL_PX, GRID_GAP_PX, layoutStrip, stripRightPx, type CustomPanel } from "../../../lib/settings/customPanels.ts";
import { FUYU_BOARD_TOP_PX, FUYU_COLUMNS, FUYU_ROWS } from "./panelSize.ts";

export const STRIP_STEP_PX = GRID_CELL_PX + GRID_GAP_PX;

export type StripRoom = { width: number; height: number };

export function stripGeometry(stored: CustomPanel, room: StripRoom | null, editing: boolean) {
  const height = cellsToPx(FUYU_ROWS);
  const scale = room ? Math.min(1, room.width / cellsToPx(FUYU_COLUMNS), room.height / (height + FUYU_BOARD_TOP_PX)) : 1;
  const fit = scale > 0 ? scale : 1;
  const visible = room ? room.width / fit : cellsToPx(FUYU_COLUMNS);
  const pageColumns = Math.max(1, Math.floor((visible + GRID_GAP_PX) / STRIP_STEP_PX));
  const panel = layoutStrip(stored, FUYU_ROWS, pageColumns);
  const right = stripRightPx(panel);
  const paged = panel.mode === "grid" && panel.items.length > 0;
  const columns = Math.max(pageColumns, Math.ceil((right + GRID_GAP_PX) / STRIP_STEP_PX) + (editing && !paged ? 1 : 0));
  const pages = paged ? Math.ceil(columns / pageColumns) : 0;
  const width = panel.mode === "free" ? Math.max(visible, right + (editing ? STRIP_STEP_PX : 0)) : cellsToPx(paged ? pages * pageColumns : columns);
  return { scale: fit, width, height, panel, pages, pageColumns, pageStepPx: pageColumns * STRIP_STEP_PX };
}
