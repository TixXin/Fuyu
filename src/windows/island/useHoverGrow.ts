import { useEffect, type RefObject } from "react";
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
const MAGNET = 6;
const PULL = 0.05;
const RESPONSE_SECONDS = 0.42;
const MAX_STEP_SECONDS = 1 / 60;

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

function islandScale(element: HTMLElement) {
  const scale = Number.parseFloat(getComputedStyle(element).getPropertyValue("--island-scale"));
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

export function useHoverGrow(ref: RefObject<HTMLElement | null>, active: boolean, allowed: boolean) {
  const reducedMotion = useReducedMotion();
  const enabled = active && allowed && !reducedMotion;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const current = (name: string) => Number.parseFloat(element.style.getPropertyValue(name)) || 0;
    const amount: Spring = { value: current("--island-hover-lift"), velocity: 0 };
    const pull: Spring = { value: current("--island-hover-pull"), velocity: 0 };
    let pointer: CursorPoint | null = null;
    let scale = islandScale(element);
    let frame = 0;
    let last = 0;

    const targets = () => {
      if (!enabled || !pointer) return { amount: 0, pull: 0 };
      const rect = element.getBoundingClientRect();
      const growX = GROW_X * scale * amount.value;
      const growY = GROW_Y * scale * amount.value;
      const width = rect.width - growX;
      const height = rect.height - growY;
      const centerX = rect.left + rect.width / 2 - MAGNET * scale * pull.value;
      const top = rect.top;
      const dx = Math.max(0, Math.abs(pointer.x - centerX) - width / 2);
      const dy = Math.max(0, top - pointer.y, pointer.y - (top + height));
      const near = Math.max(0, Math.min(1, 1 - Math.hypot(dx, dy) / (RANGE * scale)));
      const eased = near * near * (3 - 2 * near);
      const lean = Math.max(-1, Math.min(1, ((pointer.x - centerX) * PULL) / MAGNET));
      return { amount: eased, pull: lean * eased };
    };

    const write = () => {
      element.style.setProperty("--island-hover-lift", amount.value.toFixed(4));
      element.style.setProperty("--island-hover-pull", pull.value.toFixed(4));
      element.style.setProperty("--island-hover-grow-x", `${(GROW_X * scale * amount.value).toFixed(3)}px`);
      element.style.setProperty("--island-hover-grow-y", `${(GROW_Y * scale * amount.value).toFixed(3)}px`);
      element.style.setProperty("--island-hover-shift", `${(MAGNET * scale * pull.value).toFixed(3)}px`);
    };

    const step = (now: number) => {
      const seconds = last ? Math.min(0.05, (now - last) / 1000) : MAX_STEP_SECONDS;
      last = now;
      const target = targets();
      advance(amount, target.amount, seconds);
      advance(pull, target.pull, seconds);
      write();
      if (settled(amount, target.amount) && settled(pull, target.pull)) {
        amount.value = target.amount;
        pull.value = target.pull;
        amount.velocity = 0;
        pull.velocity = 0;
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

    const native = enabled && canTrackIslandCursor();
    const onMove = (event: PointerEvent) => {
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
    if (enabled) {
      document.addEventListener("pointermove", onMove);
      document.documentElement.addEventListener("pointerleave", onLeave);
      if (native) {
        acquireIslandCursor();
        void listenIslandCursor((point) => {
          pointer = point;
          wake();
        }).then((stop) => {
          if (disposed) stop();
          else unlisten = stop;
        });
      }
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
