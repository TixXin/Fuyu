import { useEffect, useRef, type RefObject } from "react";
import {
  acquireIslandCursor,
  canTrackIslandCursor,
  listenIslandCursor,
  releaseIslandCursor,
  type CursorPoint,
} from "../../lib/island-cursor/api";
import { useReducedMotion } from "../../lib/theme/useReducedMotion";

const RANGE = 70;
const GROW_X = 20;
const GROW_Y = 5;
const RESPONSE_SECONDS = 0.42;
const MAX_STEP_SECONDS = 1 / 60;
const SETTLE_AFTER_CLOSE_MS = 700;

type Spring = { value: number; velocity: number };

function advance(spring: Spring, target: number, seconds: number) {
  const omega = (2 * Math.PI) / RESPONSE_SECONDS;
  let left = seconds;
  while (left > 0) {
    const dt = Math.min(left, MAX_STEP_SECONDS);
    spring.velocity += (omega * omega * (target - spring.value) - 2 * omega * spring.velocity) * dt;
    spring.value += spring.velocity * dt;
    left -= dt;
  }
}

function settled(spring: Spring, target: number) {
  return Math.abs(spring.value - target) < 0.001 && Math.abs(spring.velocity) < 0.01;
}

function devicePixel() {
  const ratio = window.devicePixelRatio;
  return Number.isFinite(ratio) && ratio > 0 ? 1 / ratio : 1;
}

const snap = (value: number, step: number) => Math.round(value / step) * step;

function islandScale(element: HTMLElement) {
  const scale = Number.parseFloat(getComputedStyle(element).getPropertyValue("--island-scale"));
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

export function useHoverGrow(ref: RefObject<HTMLElement | null>, active: boolean, allowed: boolean) {
  const reducedMotion = useReducedMotion();
  const enabled = active && allowed && !reducedMotion;
  const wasEnabled = useRef<boolean | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const reopened = enabled && wasEnabled.current === false;
    wasEnabled.current = enabled;
    if (!enabled) {
      element.style.setProperty("--island-hover-lift", "0");
      element.style.setProperty("--island-hover-grow-x", "0px");
      element.style.setProperty("--island-hover-grow-y", "0px");
      return;
    }
    const current = (name: string) => Number.parseFloat(element.style.getPropertyValue(name)) || 0;
    const amount: Spring = { value: current("--island-hover-lift"), velocity: 0 };
    const holdUntil = reopened ? performance.now() + SETTLE_AFTER_CLOSE_MS : 0;
    let pointer: CursorPoint | null = null;
    let scale = 1;
    let frame = 0;
    let last = 0;
    let base: { width: number; height: number } | null = null;

    const targetAmount = () => {
      if (!pointer) return 0;
      const rect = element.getBoundingClientRect();
      const resized = base !== null && Math.abs(rect.width - base.width) > GROW_X * scale + 1;
      if (base === null || resized || amount.value < 0.001) base = { width: rect.width, height: rect.height };
      const { width, height } = base;
      const centerX = rect.left + rect.width / 2;
      const top = rect.top;
      const dx = Math.max(0, Math.abs(pointer.x - centerX) - width / 2);
      const dy = Math.max(0, top - pointer.y, pointer.y - (top + height));
      const near = Math.max(0, Math.min(1, 1 - Math.hypot(dx, dy) / (RANGE * scale)));
      return near * near * (3 - 2 * near);
    };

    const write = () => {
      const pixel = devicePixel();
      element.style.setProperty("--island-hover-lift", amount.value.toFixed(4));
      element.style.setProperty("--island-hover-grow-x", `${snap(GROW_X * scale * amount.value, pixel * 2).toFixed(3)}px`);
      element.style.setProperty("--island-hover-grow-y", `${snap(GROW_Y * scale * amount.value, pixel).toFixed(3)}px`);
    };

    const step = (now: number) => {
      const seconds = last ? Math.min(0.05, (now - last) / 1000) : MAX_STEP_SECONDS;
      last = now;
      const target = targetAmount();
      advance(amount, target, seconds);
      write();
      if (settled(amount, target)) {
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
  }, [ref, enabled]);
}
