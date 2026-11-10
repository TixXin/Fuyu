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

/** How close to an edge a press grabs it, in CSS pixels. */
export const GRAB = 6;

/** Keeps the pointer's moves coming while it is dragged off the overlay; a pointer the browser no longer tracks is left alone. */
export function capturePointer(event: PointerEvent<HTMLElement>) {
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
    // Not an active pointer (already released): nothing to capture.
  }
}

type Drag =
  | { kind: "draw"; origin: Point }
  | { kind: "move"; origin: Point; start: PixelRect }
  | { kind: "resize"; handle: Handle; start: PixelRect };

/**
 * The selection on this overlay's picture and the pointer over it, both in picture pixels, and
 * the pointer handlers that draw, move and resize it. A whole-monitor screenshot starts with the
 * monitor selected on the overlay under the pointer. Starting a selection here clears the other
 * monitors' overlays, so only one selection exists.
 */
export function useSelection(session: ScreenshotSession | null, bounds: Size | null, scale: number) {
  const [selection, setSelection] = useState<PixelRect | null>(null);
  const [pointer, setPointer] = useState<Point | null>(null);
  const [dragging, setDragging] = useState<Drag["kind"] | null>(null);
  const drag = useRef<Drag | null>(null);
  /** The highlighted window or control (C41.2), which a click selects; set by the overlay. */
  const hovered = useRef<PixelRect | null>(null);

  const id = session?.id ?? null;
  const whole = session?.mode === "fullscreen" && session.underPointer && bounds ? bounds : null;
  const wholeWidth = whole?.width ?? 0;
  const wholeHeight = whole?.height ?? 0;
  useEffect(() => {
    // A new screenshot (or none): start over.
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
    // From the selection at the press, so dragging past the opposite edge flips it cleanly.
    else setSelection(resizeRect(current.start, current.handle, point, bounds));
  };

  const onPointerUp = () => {
    if (drag.current?.kind === "draw") {
      // A click (no real drag) selects the highlighted window or control.
      const picked = hovered.current;
      setSelection((rect) => (rect && isSelection(rect) ? rect : picked));
    }
    drag.current = null;
    setDragging(null);
  };

  /** The pointer went to another monitor: this overlay highlights nothing. */
  const onPointerLeave = () => {
    if (!drag.current) setPointer(null);
  };

  return { selection, setSelection, pointer, dragging, hovered, onPointerDown, onPointerMove, onPointerUp, onPointerLeave };
}
