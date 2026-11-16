import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import {
  canPan, clampView, fitView, isFit, panBy, stepZoom, toggleActual, viewportCenter, wheelFactor, zoomBy, zoomPercent, zoomTo,
  type ZoomFrame, type ZoomPoint, type ZoomSize, type ZoomView,
} from "./imageZoom";
import { useClipboardPreviewCommand } from "./useClipboardPreviewCommand";

type GestureLike = Event & { scale: number; clientX: number; clientY: number };
type Drag = { pointer: number; x: number; y: number };

const EMPTY: ZoomSize = { width: 0, height: 0 };

function pointIn(element: HTMLElement, clientX: number, clientY: number): ZoomPoint {
  const rect = element.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

export function useImageZoom({ id, image, controls }: { id: string; image: ZoomSize; controls: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<ZoomSize>(EMPTY);
  const [zoom, setZoom] = useState<{ id: string; view: ZoomView } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const frame: ZoomFrame = { viewport, image, unit: 1 / (window.devicePixelRatio || 1) };
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const zoomed = zoom?.id === id ? clampView(zoom.view, frame) : null;
  const view = zoomed ?? fitView(frame);

  const update = useCallback((change: (view: ZoomView, frame: ZoomFrame) => ZoomView) => {
    setZoom((previous) => {
      const current = frameRef.current;
      const base = previous?.id === id ? clampView(previous.view, current) : fitView(current);
      const next = change(base, current);
      return isFit(next, current) ? null : { id, view: next };
    });
  }, [id]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setViewport({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element || !controls) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = pointIn(element, event.clientX, event.clientY);
      update((current, at) => zoomBy(current, wheelFactor(event.deltaY, event.deltaMode, event.ctrlKey), point, at));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [controls, update]);

  useEffect(() => {
    const element = ref.current;
    if (!element || !controls) return;
    let last = 1;
    const onStart = (event: Event) => {
      event.preventDefault();
      last = 1;
    };
    const onChange = (event: Event) => {
      event.preventDefault();
      const gesture = event as GestureLike;
      const factor = gesture.scale / last;
      last = gesture.scale;
      const point = pointIn(element, gesture.clientX, gesture.clientY);
      update((current, at) => zoomBy(current, factor, point, at));
    };
    element.addEventListener("gesturestart", onStart);
    element.addEventListener("gesturechange", onChange);
    return () => {
      element.removeEventListener("gesturestart", onStart);
      element.removeEventListener("gesturechange", onChange);
    };
  }, [controls, update]);

  useClipboardPreviewCommand((command) => {
    if (command.type !== "zoom") return;
    if (command.zoom === "reset") setZoom(null);
    else update((current, at) => stepZoom(current, command.zoom === "in" ? "in" : "out", at));
  }, controls);

  const pannable = canPan(view, frame);
  const handlers = {
    onDoubleClick: (event: MouseEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement).closest(".clipboard-zoom")) return;
      const point = pointIn(event.currentTarget, event.clientX, event.clientY);
      update((current, at) => toggleActual(current, point, at));
    },
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || !pannable || (event.target as HTMLElement).closest(".clipboard-zoom")) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag({ pointer: event.pointerId, x: event.clientX, y: event.clientY });
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      if (!drag || drag.pointer !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      setDrag({ ...drag, x: event.clientX, y: event.clientY });
      update((current, at) => panBy(current, dx, dy, at));
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
      if (drag?.pointer === event.pointerId) setDrag(null);
    },
    onPointerCancel: () => setDrag(null),
  };

  return {
    ref,
    view: zoomed,
    percent: zoomPercent(view, frame),
    pannable,
    dragging: drag !== null,
    handlers,
    zoomIn: () => update((current, at) => stepZoom(current, "in", at)),
    zoomOut: () => update((current, at) => stepZoom(current, "out", at)),
    fit: () => setZoom(null),
    actual: () => update((current, at) => zoomTo(current, at.unit, viewportCenter(at), at)),
  };
}
