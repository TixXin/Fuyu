import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { getResizeState } from "./session.ts";

export type ResizeHandle = { start: () => void; reset?: () => void };

const CURSOR_ATTRIBUTE = "islandResizeCursor";
const REACH = 6;

function handleAt(root: HTMLElement, x: number, y: number) {
  for (const element of root.querySelectorAll<HTMLElement>("[data-resize-handle]")) {
    const style = getComputedStyle(element);
    if (style.pointerEvents === "none" || style.visibility === "hidden") continue;
    const rect = element.getBoundingClientRect();
    if (x >= rect.left - REACH && x <= rect.right + REACH && y >= rect.top - REACH && y <= rect.bottom + REACH) return element;
  }
  return null;
}

function showCursor(cursor: string | null) {
  const root = document.documentElement;
  if (cursor) root.dataset[CURSOR_ATTRIBUTE] = cursor;
  else delete root.dataset[CURSOR_ATTRIBUTE];
}

export function useHandleCapture(rootRef: RefObject<HTMLDivElement | null>, handles: Map<string, ResizeHandle>, active: boolean) {
  const latest = useRef(handles);
  useLayoutEffect(() => {
    latest.current = handles;
  });

  useEffect(() => {
    if (!active) return;
    let swallowClick = false;
    let dragCursor: string | null = null;
    const find = (event: MouseEvent) => {
      const root = rootRef.current;
      const element = root && handleAt(root, event.clientX, event.clientY);
      const handle = element && latest.current.get(element.dataset.resizeHandle ?? "");
      return element && handle ? { element, handle } : null;
    };
    const move = (event: PointerEvent) => {
      if (getResizeState().drag) {
        showCursor(dragCursor);
        return;
      }
      dragCursor = null;
      const hit = find(event);
      showCursor(hit ? getComputedStyle(hit.element).cursor : null);
    };
    const down = (event: PointerEvent) => {
      swallowClick = false;
      if (event.button !== 0) return;
      const hit = find(event);
      if (!hit) return;
      event.preventDefault();
      event.stopPropagation();
      swallowClick = true;
      dragCursor = getComputedStyle(hit.element).cursor;
      showCursor(dragCursor);
      hit.handle.start();
    };
    const click = (event: MouseEvent) => {
      if (!swallowClick || event.detail === 0) return;
      swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    };
    const doubleClick = (event: MouseEvent) => {
      const hit = find(event);
      if (!hit?.handle.reset) return;
      event.preventDefault();
      event.stopPropagation();
      hit.handle.reset();
    };
    const up = () => {
      dragCursor = null;
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("click", click, true);
    window.addEventListener("dblclick", doubleClick, true);
    return () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("click", click, true);
      window.removeEventListener("dblclick", doubleClick, true);
      showCursor(null);
    };
  }, [active, rootRef]);
}
