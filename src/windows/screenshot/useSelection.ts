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

export type PointerCoords = { clientX: number; clientY: number };

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

function sameRect(a: PixelRect | null, b: PixelRect): boolean {
  return a !== null && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export function useSelection(session: ScreenshotSession | null, bounds: Size | null, scale: number) {
  const [selection, setRawSelection] = useState<PixelRect | null>(null);
  const [fromTarget, setFromTarget] = useState(false);
  const [pointer, setPointer] = useState<Point | null>(null);
  const [dragging, setDragging] = useState<Drag["kind"] | null>(null);
  const drag = useRef<Drag | null>(null);
  const hovered = useRef<PixelRect | null>(null);

  const setSelection = (next: PixelRect | null) => {
    setFromTarget(false);
    setRawSelection(next);
  };

  const id = session?.id ?? null;
  const whole = session?.mode === "fullscreen" && session.underPointer && bounds ? bounds : null;
  const wholeWidth = whole?.width ?? 0;
  const wholeHeight = whole?.height ?? 0;
  useEffect(() => {
    setFromTarget(false);
    setRawSelection(wholeWidth > 0 ? { x: 0, y: 0, width: wholeWidth, height: wholeHeight } : null);
    setPointer(null);
    setDragging(null);
    drag.current = null;
  }, [id, wholeWidth, wholeHeight]);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    const mine = overlayLabel();
    void listenSelecting((event) => {
      if (event.payload !== mine) {
        setFromTarget(false);
        setRawSelection(null);
      }
    }).then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  const at = (event: PointerCoords) => toPixels({ x: event.clientX, y: event.clientY }, scale);

  const start = (next: Drag) => {
    drag.current = next;
    setDragging(next.kind);
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !bounds) return;
    capturePointer(event);
    const point = at(event);
    const grabbed = selection ? hitTest(selection, point, GRAB * scale) : null;
    if (selection && grabbed === "inside") {
      setFromTarget(false);
      start({ kind: "move", origin: point, start: selection });
    } else if (selection && grabbed && grabbed !== "inside") {
      setFromTarget(false);
      start({ kind: "resize", handle: grabbed, start: selection });
    } else {
      setFromTarget(false);
      start({ kind: "draw", origin: point });
      setRawSelection(null);
      void announceSelecting(overlayLabel());
    }
  };

  const onPointerMove = (event: PointerCoords) => {
    if (!bounds) return;
    const point = at(event);
    setPointer((prev) => (prev && prev.x === point.x && prev.y === point.y ? prev : point));
    const current = drag.current;
    if (!current) return;
    const next = current.kind === "draw"
      ? rectFromPoints(current.origin, point, bounds)
      : current.kind === "move"
        ? moveRect(current.start, point.x - current.origin.x, point.y - current.origin.y, bounds)
        : resizeRect(current.start, current.handle, point, bounds);
    setRawSelection((prev) => (sameRect(prev, next) ? prev : next));
  };

  const onPointerUp = () => {
    if (drag.current?.kind === "draw") {
      const picked = hovered.current;
      setRawSelection((rect) => {
        if (rect && isSelection(rect)) return rect;
        if (picked) setFromTarget(true);
        return picked;
      });
    }
    drag.current = null;
    setDragging(null);
  };

  const onPointerLeave = () => {
    if (!drag.current) setPointer(null);
  };

  return { selection, setSelection, fromTarget, pointer, dragging, hovered, onPointerDown, onPointerMove, onPointerUp, onPointerLeave };
}
