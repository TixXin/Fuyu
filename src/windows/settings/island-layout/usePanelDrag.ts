import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cellBox, GRID_CELL_PX, GRID_GAP_PX, movePanelItem, type CustomPanel } from "../../../lib/settings/customPanels";

export const STEP_PX = GRID_CELL_PX + GRID_GAP_PX;

type Drag = { index: number; pointer: number; x: number; y: number; dx: number; dy: number };

const KEY_STEPS: Readonly<Record<string, [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export function usePanelDrag(panel: CustomPanel, scale: number, onChange: (panel: CustomPanel) => void) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);

  const update = (next: Drag | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  const moveTo = (index: number, colStep: number, rowStep: number) => {
    const box = cellBox(panel.items[index]);
    onChange(movePanelItem(panel, index, box.col + colStep, box.row + rowStep));
  };

  const handlers = (index: number) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0 || (event.target instanceof Element && event.target.closest("button"))) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      update({ index, pointer: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0 });
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const current = dragRef.current;
      if (!current || current.pointer !== event.pointerId) return;
      update({ ...current, dx: (event.clientX - current.x) / scale, dy: (event.clientY - current.y) / scale });
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const current = dragRef.current;
      if (!current || current.pointer !== event.pointerId) return;
      update(null);
      const cols = Math.round(current.dx / STEP_PX);
      const rows = Math.round(current.dy / STEP_PX);
      if (cols !== 0 || rows !== 0) moveTo(current.index, cols, rows);
    },
    onPointerCancel: () => update(null),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      const step = KEY_STEPS[event.key];
      if (!step || event.target !== event.currentTarget) return;
      event.preventDefault();
      moveTo(index, step[0], step[1]);
    },
  });

  return { drag, handlers };
}
