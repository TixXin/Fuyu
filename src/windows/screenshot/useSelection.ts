import { useEffect, useRef, useState, type PointerEvent } from "react";
import { announceSelecting, listenSelecting, overlayLabel, type ScreenshotSession } from "../../features/screenshot/api";
import {
  hitTest,
  isSelection,
  moveRect,
  rectFromPoints,
  resizeRect,
  toPixels,
  type Handle,
  type PixelRect,
  type Point,
  type Size,
} from "../../features/screenshot/selection";

export const GRAB = 6;

export function capturePointer(event: PointerEvent<HTMLElement>) {
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
  }
}

type Drag =
  | { kind: "draw"; origin: Point }
  | { kind: "move"; origin: Point; start: PixelRect }
  | { kind: "resize"; handle: Handle; start: PixelRect };

export function useSelection(session: ScreenshotSession | null, bounds: Size | null, scale: number) {
  const [selection, setSelection] = useState<PixelRect | null>(null);
  const [pointer, setPointer] = useState<Point | null>(null);
  const [dragging, setDragging] = useState<Drag["kind"] | null>(null);
  const drag = useRef<Drag | null>(null);
  const hovered = useRef<PixelRect | null>(null);

  const id = session?.id ?? null;
  const whole = session?.mode === "fullscreen" && session.underPointer && bounds ? bounds : null;
  const wholeWidth = whole?.width ?? 0;
  const wholeHeight = whole?.height ?? 0;
  useEffect(() => {
    setSelection(wholeWidth > 0 ? { x: 0, y: 0, width: wholeWidth, height: wholeHeight } : null);
    setPointer(null);
    setDragging(null);
    drag.current = null;
  }, [id, wholeWidth, wholeHeight]);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    const mine = overlayLabel();
    void listenSelecting((event) => {
      if (event.payload !== mine) setSelection(null);
    }).then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  const at = (event: PointerEvent) => toPixels({ x: event.clientX, y: event.clientY }, scale);

  const start = (next: Drag) => {
    drag.current = next;
    setDragging(next.kind);
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !bounds) return;
    capturePointer(event);
    const point = at(event);
    const grabbed = selection ? hitTest(selection, point, GRAB * scale) : null;
    if (selection && grabbed === "inside") start({ kind: "move", origin: point, start: selection });
    else if (selection && grabbed && grabbed !== "inside") start({ kind: "resize", handle: grabbed, start: selection });
    else {
      start({ kind: "draw", origin: point });
      setSelection(null);
      void announceSelecting(overlayLabel());
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!bounds) return;
    const point = at(event);
    setPointer(point);
    const current = drag.current;
    if (!current) return;
    if (current.kind === "draw") setSelection(rectFromPoints(current.origin, point, bounds));
    else if (current.kind === "move") setSelection(moveRect(current.start, point.x - current.origin.x, point.y - current.origin.y, bounds));
    else setSelection(resizeRect(current.start, current.handle, point, bounds));
  };

  const onPointerUp = () => {
    if (drag.current?.kind === "draw") {
      const picked = hovered.current;
      setSelection((rect) => (rect && isSelection(rect) ? rect : picked));
    }
    drag.current = null;
    setDragging(null);
  };

  const onPointerLeave = () => {
    if (!drag.current) setPointer(null);
  };

  return { selection, setSelection, pointer, dragging, hovered, onPointerDown, onPointerMove, onPointerUp, onPointerLeave };
}
