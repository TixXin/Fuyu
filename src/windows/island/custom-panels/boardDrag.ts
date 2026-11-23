import type { BoxDrag } from "../../../components/island-widget/useBoxDrag";
import {
  addPanelItem,
  freeLeastPx,
  GRID_UNIT_PX,
  itemBoxPx,
  movePanelItemTo,
  placeFreeItem,
  stretchFreeItem,
  stripInsertIndexAt,
  type CustomPanel,
  type PanelSize,
} from "../../../lib/settings/customPanels.ts";
import { snapMove, snapStretch, type Snapped } from "./freeSnap.ts";

export type Board = { width: number; height: number; page?: number; rows?: number };
export type IncomingWidget = { widget: string; name: string; size: PanelSize; x: number; y: number };
type Moved = Pick<BoxDrag, "widget" | "kind" | "dx" | "dy">;

const within = (value: number, low: number, high: number) => Math.min(Math.max(value, low), Math.max(low, high));
const units = (px: number) => Math.floor(px / GRID_UNIT_PX);

export function freeTarget(panel: CustomPanel, drag: Moved, board: Board): Snapped | null {
  const item = panel.items.find((candidate) => candidate.widget === drag.widget);
  if (!item || panel.mode !== "free") return null;
  const box = itemBoxPx(panel, item);
  const others = panel.items.filter((other) => other !== item).map((other) => itemBoxPx(panel, other));
  if (drag.kind === "move") return snapMove({ ...box, left: box.left + drag.dx, top: box.top + drag.dy }, others, board.width, board.height);
  return snapStretch({ ...box, width: box.width + drag.dx, height: box.height + drag.dy }, others, board.width, freeLeastPx(item.size), board.height);
}

export function draggedTo(panel: CustomPanel, drag: Moved, board: Board): CustomPanel {
  const item = panel.items.find((candidate) => candidate.widget === drag.widget);
  if (!item) return panel;
  const target = freeTarget(panel, drag, board);
  if (target) {
    if (drag.kind === "move") return placeFreeItem(panel, drag.widget, target.left / GRID_UNIT_PX, target.top / GRID_UNIT_PX, units(board.width), units(board.height));
    return stretchFreeItem(panel, drag.widget, target.width / GRID_UNIT_PX, target.height / GRID_UNIT_PX, units(board.width), units(board.height));
  }
  if (drag.kind !== "move") return panel;
  const box = itemBoxPx(panel, item);
  return movePanelItemTo(panel, drag.widget, stripInsertIndexAt(panel, box.left + box.width / 2 + drag.dx, box.top + box.height / 2 + drag.dy, drag.widget));
}

export function keptInside<Drag extends Moved>(panel: CustomPanel, drag: Drag, board: Board): Drag {
  const item = panel.items.find((candidate) => candidate.widget === drag.widget);
  if (!item) return drag;
  const box = itemBoxPx(panel, item);
  if (drag.kind === "stretch") return { ...drag, dx: Math.min(drag.dx, board.width - box.left - box.width), dy: Math.min(drag.dy, board.height - box.top - box.height) };
  return { ...drag, dx: within(drag.dx, -box.left, board.width - box.left - box.width), dy: within(drag.dy, -box.top, board.height - box.top - box.height) };
}

export function dropIncoming(panel: CustomPanel, incoming: IncomingWidget, board: Board): CustomPanel {
  const added = addPanelItem(panel, incoming.widget, incoming.size);
  if (added === panel) return panel;
  if (panel.mode === "grid") return movePanelItemTo(added, incoming.widget, stripInsertIndexAt(panel, incoming.x, incoming.y, null));
  const least = freeLeastPx(incoming.size);
  return placeFreeItem(added, incoming.widget, (incoming.x - least.width / 2) / GRID_UNIT_PX, (incoming.y - least.height / 2) / GRID_UNIT_PX, units(board.width), units(board.height));
}

export function previewOf(panel: CustomPanel, drag: Moved | null, incoming: IncomingWidget | null, board: Board): CustomPanel {
  if (incoming) return dropIncoming(panel, incoming, board);
  return drag ? draggedTo(panel, drag, board) : panel;
}
