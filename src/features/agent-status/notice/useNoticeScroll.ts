import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useReducedMotion } from "../../../lib/theme/useReducedMotion";

const EDGE_PX = 2;
const MIN_THUMB_PX = 18;
const SHOW_AFTER_SCROLL_MS = 700;
const LINE_DELTA_PX = 18;
const SMOOTH_STEP = 0.24;
const PIXEL_WHEEL_LIMIT = 50;

export type NoticeScroll = {
  can: boolean;
  fadeTop: boolean;
  fadeBottom: boolean;
  scrolling: boolean;
  dragging: boolean;
  thumb: { height: number; offset: number };
};

const IDLE: NoticeScroll = { can: false, fadeTop: false, fadeBottom: false, scrolling: false, dragging: false, thumb: { height: 0, offset: 0 } };

export function useNoticeScroll(contentKey: unknown) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [state, setState] = useState<NoticeScroll>(IDLE);
  const reduced = useReducedMotion();
  const hideTimer = useRef<number | undefined>(undefined);
  const target = useRef<number | null>(null);
  const frame = useRef(0);

  const measure = useCallback(() => {
    if (!element) return;
    const max = element.scrollHeight - element.clientHeight;
    const can = max > EDGE_PX;
    const height = can ? Math.max(MIN_THUMB_PX, (element.clientHeight * element.clientHeight) / element.scrollHeight) : 0;
    const offset = can ? ((element.clientHeight - height) * element.scrollTop) / max : 0;
    setState((current) => {
      const next = { ...current, can, fadeTop: can && element.scrollTop > EDGE_PX, fadeBottom: can && element.scrollTop < max - EDGE_PX, thumb: { height, offset } };
      const same = current.can === next.can && current.fadeTop === next.fadeTop && current.fadeBottom === next.fadeBottom
        && current.thumb.height === height && current.thumb.offset === offset;
      return same ? current : next;
    });
  }, [element]);

  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    return () => observer.disconnect();
  }, [element, measure, contentKey]);

  useEffect(measure, [measure, contentKey]);

  useEffect(() => () => {
    window.clearTimeout(hideTimer.current);
    cancelAnimationFrame(frame.current);
  }, []);

  const onScroll = useCallback(() => {
    measure();
    setState((current) => (current.scrolling ? current : { ...current, scrolling: true }));
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setState((current) => ({ ...current, scrolling: false })), SHOW_AFTER_SCROLL_MS);
  }, [measure]);

  useEffect(() => {
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      const max = element.scrollHeight - element.clientHeight;
      if (max <= EDGE_PX) return;
      event.preventDefault();
      event.stopPropagation();
      const unit = event.deltaMode === 1 ? LINE_DELTA_PX : event.deltaMode === 2 ? element.clientHeight : 1;
      const delta = event.deltaY * unit;
      if (reduced || (event.deltaMode === 0 && Math.abs(delta) < PIXEL_WHEEL_LIMIT)) {
        cancelAnimationFrame(frame.current);
        target.current = null;
        element.scrollTop += delta;
        return;
      }
      target.current = Math.max(0, Math.min(max, (target.current ?? element.scrollTop) + delta));
      cancelAnimationFrame(frame.current);
      const step = () => {
        if (target.current === null) return;
        const gap = target.current - element.scrollTop;
        if (Math.abs(gap) < 0.5) {
          element.scrollTop = target.current;
          target.current = null;
          return;
        }
        element.scrollTop += gap * SMOOTH_STEP;
        frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [element, reduced]);

  const onThumbPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!element) return;
    event.preventDefault();
    event.stopPropagation();
    const thumb = event.currentTarget;
    thumb.setPointerCapture(event.pointerId);
    const startY = event.clientY;
    const startTop = element.scrollTop;
    const ratio = (element.scrollHeight - element.clientHeight) / Math.max(1, element.clientHeight - state.thumb.height);
    setState((current) => ({ ...current, dragging: true }));
    const move = (moved: PointerEvent) => {
      element.scrollTop = startTop + (moved.clientY - startY) * ratio;
    };
    const up = () => {
      setState((current) => ({ ...current, dragging: false }));
      thumb.removeEventListener("pointermove", move);
      thumb.removeEventListener("pointerup", up);
      thumb.removeEventListener("pointercancel", up);
    };
    thumb.addEventListener("pointermove", move);
    thumb.addEventListener("pointerup", up);
    thumb.addEventListener("pointercancel", up);
  }, [element, state.thumb.height]);

  return { ref: setElement, state, onScroll, onThumbPointerDown };
}
