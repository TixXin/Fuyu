import { useState, type RefObject } from "react";
import type { LibraryWidget } from "../../../features/plugin-kernel/widgetLibrary";
import { addPanelItem, defaultWidgetSize, GRID_UNIT_PX, placeFreeItem, stripRightPx, type CustomPanel } from "../../../lib/settings/customPanels";
import { dropIncoming, type Board, type IncomingWidget } from "./boardDrag";
import type { Outside } from "./paging/usePanelDrag";
import type { PickerDrag } from "./WidgetPicker";

type PickerDropOptions = {
  panel: CustomPanel;
  board: Board;
  area: RefObject<HTMLElement | null>;
  grid: RefObject<HTMLElement | null>;
  routed: boolean;
  onChange: (panel: CustomPanel) => void;
  moveOutside: (outside: Outside | null) => void;
  dropOutside: () => void;
};

function boardPoint(grid: HTMLElement | null, area: HTMLElement | null, drag: PickerDrag): { x: number; y: number } | null {
  if (!grid || !area) return null;
  const bounds = area.getBoundingClientRect();
  if (drag.clientX < bounds.left || drag.clientX > bounds.right || drag.clientY < bounds.top || drag.clientY > bounds.bottom) return null;
  const rect = grid.getBoundingClientRect();
  const factor = rect.width > 0 ? grid.offsetWidth / rect.width : 1;
  return { x: (drag.clientX - rect.left) * factor, y: (drag.clientY - rect.top) * factor };
}

export function usePickerDrop({ panel, board, area, grid, routed, onChange, moveOutside, dropOutside }: PickerDropOptions) {
  const [incoming, setIncoming] = useState<IncomingWidget | null>(null);
  const add = (widget: LibraryWidget) => {
    const size = defaultWidgetSize(widget.sizes);
    if (!size) return;
    const added = addPanelItem(panel, widget.id, size);
    onChange(panel.mode === "free" ? placeFreeItem(added, widget.id, stripRightPx(panel) / GRID_UNIT_PX + 1, 0, Infinity, Math.floor(board.height / GRID_UNIT_PX)) : added);
  };
  const incomingOf = (picked: PickerDrag | null): IncomingWidget | null => {
    const size = picked ? defaultWidgetSize(picked.widget.sizes) : null;
    const point = picked && size ? boardPoint(grid.current, area.current, picked) : null;
    return picked && size && point ? { widget: picked.widget.id, name: picked.widget.name, size, ...point } : null;
  };
  const drag = (picked: PickerDrag | null) => {
    if (!routed) return setIncoming(incomingOf(picked));
    const size = picked ? defaultWidgetSize(picked.widget.sizes) : null;
    moveOutside(picked && size ? { source: "picker", item: { widget: picked.widget.id, size, x: 0, y: 0, w: 0, h: 0 }, x: picked.clientX, y: picked.clientY } : null);
  };
  const drop = (picked: PickerDrag) => {
    if (routed) return dropOutside();
    const placed = incomingOf(picked);
    if (placed) onChange(dropIncoming(panel, placed, board));
    else if (panel.items.length === 0 && boardPoint(area.current, area.current, picked)) add(picked.widget);
  };
  return { incoming, add, drag, drop };
}
