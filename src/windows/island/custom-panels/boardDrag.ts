import type { BoxDrag } from "../../../components/island-widget/useBoxDrag";
import {
  boardHeightPx,
  dropNewPanelItem,
  freeLeastPx,
  GRID_UNIT_PX,
  insertIndexAt,
  itemBoxPx,
  movePanelItemTo,
  placeFreeItem,
  stretchFreeItem,
  type CustomPanel,
  type PanelSize,
} from "../../../lib/settings/customPanels.ts";
import { snapMove, snapStretch, type Snapped } from "./freeSnap.ts";

export type DragArea = { left: number; top: number; right: number; bottom: number };
export type IncomingWidget = { widget: string; name: string; size: PanelSize; x: number; y: number };
type Moved = Pick<BoxDrag, "widget" | "kind" | "dx" | "dy">;

const within = (value: number, low: number, high: number) => Math.min(Math.max(value, low), Math.max(low, high));
const widthUnits = (width: number) => Math.floor(width / GRID_UNIT_PX);

export function freeTarget(panel: CustomPanel, drag: Moved, width: number): Snapped | null {
  const item = panel.items.find((candidate) => candidate.widget === drag.widget);
  if (!item || panel.mode !== "free") return null;
  const box = itemBoxPx(panel, item);
  const others = panel.items.filter((other) => other !== item).map((other) => itemBoxPx(panel, other));
  if (drag.kind === "move") return snapMove({ ...box, left: box.left + drag.dx, top: box.top + drag.dy }, others, width);
  return snapStretch({ ...box, width: box.width + drag.dx, height: box.height + drag.dy }, others, width, freeLeastPx(item.size));
}

export function draggedTo(panel: CustomPanel, drag: Moved, width: number): CustomPanel {
  const item = panel.items.find((candidate) => candidate.widget === drag.widget);
  if (!item) return panel;
  const target = freeTarget(panel, drag, width);
  if (target) {
    const units = widthUnits(width);
    if (drag.kind === "move") return placeFreeItem(panel, drag.widget, target.left / GRID_UNIT_PX, target.top / GRID_UNIT_PX, units);
    return stretchFreeItem(panel, drag.widget, target.width / GRID_UNIT_PX, target.height / GRID_UNIT_PX, units);
  }
  if (drag.kind !== "move") return panel;
  const box = itemBoxPx(panel, item);
  return movePanelItemTo(panel, drag.widget, insertIndexAt(panel, box.left + box.width / 2 + drag.dx, box.top + box.height / 2 + drag.dy, drag.widget));
}

export function keptInside<Drag extends Moved>(panel: CustomPanel, drag: Drag, area: DragArea | null, width: number): Drag {
  const item = panel.items.find((candidate) => candidate.widget === drag.widget);
  if (!item) return drag;
  const box = itemBoxPx(panel, item);
  const free = panel.mode === "free";
  const left = free || !area ? 0 : Math.min(0, area.left);
  const right = free || !area ? width : Math.max(width, area.right);
  const top = free || !area ? 0 : Math.min(0, area.top);
  const bottom = Math.max(area?.bottom ?? 0, boardHeightPx(panel));
  if (drag.kind === "stretch") return { ...drag, dx: Math.min(drag.dx, width - box.left - box.width), dy: Math.min(drag.dy, bottom - box.top - box.height) };
  return { ...drag, dx: within(drag.dx, left - box.left, right - box.left - box.width), dy: within(drag.dy, top - box.top, bottom - box.top - box.height) };
}

export function previewOf(panel: CustomPanel, drag: Moved | null, incoming: IncomingWidget | null, width: number): CustomPanel {
  if (incoming) return dropIncoming(panel, incoming, width);
  return drag ? draggedTo(panel, drag, width) : panel;
}

export function dropIncoming(panel: CustomPanel, incoming: IncomingWidget, width: number): CustomPanel {
  return dropNewPanelItem(panel, incoming.widget, incoming.size, incoming.x, incoming.y, widthUnits(width));
}
