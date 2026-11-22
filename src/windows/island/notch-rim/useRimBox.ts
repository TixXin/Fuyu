import { useEffect, useRef, useState, type RefObject } from "react";
import { sameRimBox, type RimBox } from "./rimGeometry.ts";

function px(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readBox(shell: HTMLElement, probe: HTMLElement, size: { width: number; height: number } | null): RimBox {
  const style = getComputedStyle(shell);
  const k = Number.parseFloat(style.getPropertyValue("--island-corner-k"));
  return {
    width: size?.width ?? shell.offsetWidth,
    height: size?.height ?? shell.offsetHeight,
    fillet: px(getComputedStyle(probe).width),
    corner: px(style.getPropertyValue("--island-shell-bottom-corner")),
    k: Number.isFinite(k) ? k : 0.5523,
  };
}

function sameExactly(a: RimBox | null, b: RimBox) {
  return a !== null && a.width === b.width && a.height === b.height && a.fillet === b.fillet && a.corner === b.corner && a.k === b.k;
}

export function useRimBox(probeRef: RefObject<HTMLElement | null>): RimBox | null {
  const [box, setBox] = useState<RimBox | null>(null);
  const lastRef = useRef<RimBox | null>(null);

  useEffect(() => {
    const probe = probeRef.current;
    const shell = probe?.parentElement?.parentElement;
    if (!probe || !shell) return;
    let frame = 0;
    let size: { width: number; height: number } | null = null;
    let exact = false;
    let resized = false;
    const measure = () => {
      frame = 0;
      const next = readBox(shell, probe, size);
      const settled = exact;
      if (resized) exact = false;
      if (settled ? sameExactly(lastRef.current, next) : sameRimBox(lastRef.current, next)) return;
      lastRef.current = next;
      setBox(next);
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver((entries) => {
      const border = entries[0]?.borderBoxSize?.[0];
      size = border ? { width: border.inlineSize, height: border.blockSize } : null;
      resized = true;
      schedule();
    });
    observer.observe(shell);
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target !== shell) return;
      exact = true;
      resized = false;
      schedule();
    };
    shell.addEventListener("transitionend", onTransitionEnd);
    schedule();
    return () => {
      observer.disconnect();
      shell.removeEventListener("transitionend", onTransitionEnd);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [probeRef]);

  return box;
}
