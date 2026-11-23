import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { useReducedMotion } from "../../lib/theme/useReducedMotion";
import type { PixelMood } from "./pixel/pixelPoses";
import { createPixelRenderer } from "./pixel/pixelRuntime";
import type { PixelJellyfishStyle } from "./pixel/pixelStyles";
import "./JellyfishMark.css";
import "./PixelJellyfish.css";

export function PixelJellyfish({ style, mood, paused = false, height }: { style: PixelJellyfishStyle; mood: PixelMood; paused?: boolean; height?: number }) {
  const wrap = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof createPixelRenderer> | null>(null);
  const still = useReducedMotion();

  useLayoutEffect(() => {
    if (!wrap.current || !canvas.current) return undefined;
    const created = createPixelRenderer(wrap.current, canvas.current);
    renderer.current = created;
    return () => {
      created.dispose();
      renderer.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    renderer.current?.update({ style, mood, paused, still });
  }, [style, mood, paused, still]);

  return (
    <span
      ref={wrap}
      className="center-jelly center-jelly--pixel"
      data-mood={mood}
      data-pixel-style={style}
      style={height === undefined ? undefined : ({ "--center-jelly-height": `${height}px` } as CSSProperties)}
      aria-hidden="true"
    >
      <canvas ref={canvas} />
    </span>
  );
}
