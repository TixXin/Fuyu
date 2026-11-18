import { isTauri } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { isMacOS } from "../../lib/platform";
import { syncIslandGlassFrame, type IslandGlassFrame } from "./api";

const GEOMETRY_PROPS = new Set([
  "--island-shell-width",
  "--island-shell-height",
  "--island-shell-top-corner",
  "--island-shell-bottom-corner",
  "width",
  "height",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-left-radius",
  "border-bottom-right-radius",
]);

const MAX_LOOP_MS = 1200;

export function readIslandGlassFrame(activeTransition = false): IslandGlassFrame | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector<HTMLElement>(".island");
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const style = window.getComputedStyle(el);
  const tl = parseFloat(style.borderTopLeftRadius) || 0;
  const tr = parseFloat(style.borderTopRightRadius) || 0;
  const bl = parseFloat(style.borderBottomLeftRadius) || 0;
  const br = parseFloat(style.borderBottomRightRadius) || 0;
  const filletSize = parseFloat(style.getPropertyValue("--island-top-fillet-size")) || 0;
  const scale = parseFloat(style.getPropertyValue("--island-scale")) || 1;
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    topRadius: Math.min(tl, tr),
    bottomRadius: Math.max(tl, tr, bl, br),
    filletRadius: Math.round(Math.max(0, filletSize * scale)),
    activeTransition,
  };
}

function sameFrame(a: IslandGlassFrame | null, b: IslandGlassFrame): boolean {
  if (!a || a.activeTransition !== b.activeTransition) return false;
  return (
    Math.abs(a.left - b.left) < 0.1 &&
    Math.abs(a.top - b.top) < 0.1 &&
    Math.abs(a.width - b.width) < 0.1 &&
    Math.abs(a.height - b.height) < 0.1 &&
    Math.abs(a.topRadius - b.topRadius) < 0.1 &&
    Math.abs(a.bottomRadius - b.bottomRadius) < 0.1 &&
    a.filletRadius === b.filletRadius
  );
}

export function useNativeGlassSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !isMacOS || !isTauri()) return;
    const island = document.querySelector<HTMLElement>(".island");
    if (!island) return;

    const activeProps = new Set<string>();
    let rafId = 0;
    let startedAt = 0;
    let lastSent: IslandGlassFrame | null = null;

    const pushFrame = (active: boolean) => {
      const next = readIslandGlassFrame(active);
      if (!next || sameFrame(lastSent, next)) return;
      lastSent = next;
      void syncIslandGlassFrame(next).catch(() => {});
    };

    const stopLoop = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      pushFrame(false);
    };

    const tick = (now: number) => {
      if (activeProps.size === 0 || now - startedAt > MAX_LOOP_MS) {
        activeProps.clear();
        rafId = 0;
        pushFrame(false);
        return;
      }
      pushFrame(true);
      rafId = requestAnimationFrame(tick);
    };

    const startLoop = () => {
      startedAt = performance.now();
      if (!rafId) {
        pushFrame(true);
        rafId = requestAnimationFrame(tick);
      }
    };

    const onStart = (event: TransitionEvent) => {
      if (event.target !== island || !GEOMETRY_PROPS.has(event.propertyName)) return;
      activeProps.add(event.propertyName);
      startLoop();
    };

    const onEnd = (event: TransitionEvent) => {
      if (event.target !== island || !GEOMETRY_PROPS.has(event.propertyName)) return;
      activeProps.delete(event.propertyName);
      if (activeProps.size === 0) {
        stopLoop();
      }
    };

    const observer = new ResizeObserver(() => {
      pushFrame(activeProps.size > 0);
    });
    observer.observe(island);

    island.addEventListener("transitionrun", onStart);
    island.addEventListener("transitionstart", onStart);
    island.addEventListener("transitionend", onEnd);
    island.addEventListener("transitioncancel", onEnd);
    pushFrame(false);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      observer.disconnect();
      island.removeEventListener("transitionrun", onStart);
      island.removeEventListener("transitionstart", onStart);
      island.removeEventListener("transitionend", onEnd);
      island.removeEventListener("transitioncancel", onEnd);
    };
  }, [enabled]);
}
