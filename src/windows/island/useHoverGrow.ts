import { useEffect, useRef, type RefObject } from "react";
import {
  acquireIslandCursor,
  canTrackIslandCursor,
  listenIslandCursor,
  releaseIslandCursor,
  type CursorPoint,
} from "../../lib/island-cursor/api";
import { useReducedMotion } from "../../lib/theme/useReducedMotion";
import { advanceHoverSpring, hoverNearness, hoverSettled, islandHoverShape, type HoverSpring } from "../../lib/theme/islandHover";
import type { IslandBounce, IslandHover } from "../../lib/settings/types";

const SETTLE_AFTER_CLOSE_MS = 700;

function devicePixel() {
  const ratio = window.devicePixelRatio;
  return Number.isFinite(ratio) && ratio > 0 ? 1 / ratio : 1;
}

const snap = (value: number, step: number) => Math.round(value / step) * step;

function islandScale(element: HTMLElement) {
  const scale = Number.parseFloat(getComputedStyle(element).getPropertyValue("--island-scale"));
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

export function useHoverGrow(ref: RefObject<HTMLElement | null>, active: boolean, hover: IslandHover, bounce: IslandBounce = "regular") {
  const reducedMotion = useReducedMotion();
  const shape = islandHoverShape(hover, bounce);
  const enabled = active && shape !== null && !reducedMotion;
  const wasEnabled = useRef<boolean | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const reopened = enabled && wasEnabled.current === false;
    wasEnabled.current = enabled;
    if (!enabled || !shape) {
      element.style.setProperty("--island-hover-lift", (0).toFixed(4));
      element.style.setProperty("--island-hover-grow-x", `${(0).toFixed(3)}px`);
      element.style.setProperty("--island-hover-grow-y", `${(0).toFixed(3)}px`);
      return;
    }
    const { growX, growY, range, response, damping } = shape;
    const current = (name: string) => Number.parseFloat(element.style.getPropertyValue(name)) || 0;
    const amount: HoverSpring = { value: current("--island-hover-lift"), velocity: 0 };
    const holdUntil = reopened ? performance.now() + SETTLE_AFTER_CLOSE_MS : 0;
    let pointer: CursorPoint | null = null;
    let scale = 1;
    let frame = 0;
    let last = 0;
    let base: { width: number; height: number } | null = null;

    const targetAmount = () => {
      if (!pointer) return 0;
      const rect = element.getBoundingClientRect();
      const resized = base !== null && Math.abs(rect.width - base.width) > growX * scale + 1;
      if (base === null || resized || amount.value < 0.001) base = { width: rect.width, height: rect.height };
      const { width, height } = base;
      const centerX = rect.left + rect.width / 2;
      const top = rect.top;
      const dx = Math.max(0, Math.abs(pointer.x - centerX) - width / 2);
      const dy = Math.max(0, top - pointer.y, pointer.y - (top + height));
      return hoverNearness(Math.hypot(dx, dy), range * scale);
    };

    const write = () => {
      const pixel = devicePixel();
      element.style.setProperty("--island-hover-lift", amount.value.toFixed(4));
      element.style.setProperty("--island-hover-grow-x", `${snap(growX * scale * amount.value, pixel * 2).toFixed(3)}px`);
      element.style.setProperty("--island-hover-grow-y", `${snap(growY * scale * amount.value, pixel).toFixed(3)}px`);
    };

    const step = (now: number) => {
      const seconds = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const target = targetAmount();
      advanceHoverSpring(amount, target, seconds, response, damping);
      write();
      if (hoverSettled(amount, target)) {
        amount.value = target;
        amount.velocity = 0;
        write();
        frame = 0;
        last = 0;
        return;
      }
      frame = requestAnimationFrame(step);
    };

    const wake = () => {
      if (frame) return;
      scale = islandScale(element);
      frame = requestAnimationFrame(step);
    };

    const native = canTrackIslandCursor();
    const settling = () => performance.now() < holdUntil;
    const onMove = (event: PointerEvent) => {
      if (settling()) return;
      pointer = { x: event.clientX, y: event.clientY };
      wake();
    };
    const onLeave = () => {
      if (native) return;
      pointer = null;
      wake();
    };
    let unlisten: (() => void) | null = null;
    let disposed = false;
    document.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    if (native) {
      acquireIslandCursor();
      void listenIslandCursor((point) => {
        if (settling()) return;
        pointer = point;
        wake();
      }).then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      });
    }
    wake();

    return () => {
      disposed = true;
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      if (native) releaseIslandCursor();
      unlisten?.();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref, enabled, shape]);
}
