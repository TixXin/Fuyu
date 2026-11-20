import { useRef, useState } from "react";
import {
  annotationAt,
  annotationLevel,
  canRecolor,
  dragHandle,
  handleAt,
  moveAnnotation,
  restyleAnnotation,
  type AnnotationHandle,
} from "../../features/screenshot/annotationEdit";
import type { Annotation, StrokeLevel } from "../../features/screenshot/annotations";
import type { Point } from "../../features/screenshot/selection";
import type { Annotations } from "./useAnnotations";

const HIT_SLACK = 4;
const HANDLE_REACH = 7;

type Drag = { item: Annotation; handle: AnnotationHandle | null; from: Point; current: Annotation };

export function handleCursorOf(handle: AnnotationHandle): string {
  return handle === "nw" || handle === "se" ? "nwse-resize" : handle === "ne" || handle === "sw" ? "nesw-resize" : "pointer";
}

export function useAnnotationSelect(annotations: Annotations, scale: number) {
  const [picked, setPicked] = useState<Annotation | null>(null);
  const [drag, setDragState] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const setDrag = (next: Drag | null) => {
    dragRef.current = next;
    setDragState(next);
  };
  const { items } = annotations;
  const selected = picked && items.includes(picked) && !annotations.tool ? picked : null;

  const hover = (point: Point, inside: boolean): string | null => {
    if (selected) {
      const handle = handleAt(selected, point, HANDLE_REACH * scale);
      if (handle) return handleCursorOf(handle);
    }
    return inside && annotationAt(items, point, HIT_SLACK * scale) ? "move" : null;
  };

  const pick = (point: Point, inside: boolean): boolean => {
    const handle = selected ? handleAt(selected, point, HANDLE_REACH * scale) : null;
    const item = selected && handle ? selected : inside ? annotationAt(items, point, HIT_SLACK * scale) : null;
    setPicked(item);
    if (!item) return false;
    setDrag({ item, handle, from: point, current: item });
    return true;
  };

  const move = (point: Point) => {
    const active = dragRef.current;
    if (!active) return;
    const current = active.handle ? dragHandle(active.item, active.handle, point) : moveAnnotation(active.item, point.x - active.from.x, point.y - active.from.y);
    setDrag({ ...active, current });
  };

  const end = (): boolean => {
    const active = dragRef.current;
    if (!active) return false;
    setDrag(null);
    const moved = active.current !== active.item;
    if (moved) {
      annotations.replace(active.item, active.current);
      setPicked(active.current);
    }
    return true;
  };

  const restyle = (change: { color?: string; level?: StrokeLevel }) => {
    if (!selected) return;
    const next = restyleAnnotation(selected, change, scale);
    if (next === selected) return;
    annotations.replace(selected, next);
    setPicked(next);
  };

  const shown = drag ? items.map((item) => (item === drag.item ? drag.current : item)) : items;

  return {
    selected: drag ? drag.current : selected,
    level: selected ? annotationLevel(selected, scale) : null,
    recolorable: selected ? canRecolor(selected) : false,
    dragging: drag !== null,
    items: shown,
    hover,
    pick,
    move,
    end,
    restyle,
    remove: () => {
      if (selected) annotations.remove(selected);
      setPicked(null);
    },
    clear: () => setPicked(null),
  };
}

export type AnnotationSelect = ReturnType<typeof useAnnotationSelect>;
