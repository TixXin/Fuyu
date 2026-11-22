import { useEffect, useRef } from "react";
import { MousePointer2 } from "lucide-react";
import { advanceHoverSpring, hoverNearness, hoverSettled, islandHoverShape, type HoverSpring } from "../../../../lib/theme/islandHover";
import type { IslandBounce, IslandHover } from "../../../../lib/settings/types";
import "./MotionThumbs.css";

const SCALE = 0.5;
const APPROACH_MS = 700;
const LEAVE_AT_MS = 1500;
const LEAVE_MS = 500;
const START_GAP = 30;

function distanceAt(elapsed: number, start: number) {
  if (elapsed < APPROACH_MS) return start * (1 - elapsed / APPROACH_MS);
  if (elapsed < LEAVE_AT_MS) return 0;
  return start * Math.min(1, (elapsed - LEAVE_AT_MS) / LEAVE_MS);
}

export function HoverThumb({ hover, bounce, play, islandColor }: { hover: IslandHover; bounce: IslandBounce; play: boolean; islandColor: string }) {
  const islandRef = useRef<HTMLSpanElement>(null);
  const pointerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const island = islandRef.current;
    const pointer = pointerRef.current;
    const shape = islandHoverShape(hover, bounce);
    const paint = (spring: HoverSpring, distance: number | null) => {
      island?.style.setProperty("--hover-thumb-x", `${((shape?.growX ?? 0) * spring.value * SCALE).toFixed(2)}px`);
      island?.style.setProperty("--hover-thumb-y", `${((shape?.growY ?? 0) * spring.value * SCALE).toFixed(2)}px`);
      if (!pointer) return;
      pointer.style.opacity = distance === null ? "0" : "1";
      pointer.style.transform = `translateY(${((distance ?? 0) * SCALE).toFixed(2)}px)`;
    };
    const resting = { value: 0, velocity: 0 };
    paint(resting, null);
    if (!play) return;

    const start = (shape?.range ?? 0) + START_GAP;
    const spring: HoverSpring = { ...resting };
    let begun = 0;
    let last = 0;
    let frame = 0;
    const step = (now: number) => {
      begun ||= now;
      const seconds = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const elapsed = now - begun;
      const distance = distanceAt(elapsed, start);
      const goal = shape ? hoverNearness(distance, shape.range) : 0;
      if (shape) advanceHoverSpring(spring, goal, seconds, shape.response, shape.damping);
      const done = elapsed >= LEAVE_AT_MS + LEAVE_MS && (!shape || hoverSettled(spring, goal));
      paint(done ? resting : spring, done ? null : distance);
      if (!done) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      paint(resting, null);
    };
  }, [hover, bounce, play]);

  return (
    <span className="hover-thumb" aria-hidden="true">
      <span ref={islandRef} className="hover-thumb__island" style={{ background: islandColor }} />
      <span ref={pointerRef} className="hover-thumb__pointer">
        <MousePointer2 size={12} strokeWidth={2} />
      </span>
    </span>
  );
}
