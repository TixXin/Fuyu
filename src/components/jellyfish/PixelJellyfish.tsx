import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { useReducedMotion } from "../../lib/theme/useReducedMotion";
import type { LivelyJelly } from "./useLivelyJelly";
import { createPixelRenderer } from "./pixel/pixelRuntime";
import type { PixelJellyfishStyle } from "./pixel/pixelStyles";
import "./JellyfishMark.css";
import "./PixelJellyfish.css";

type PixelJellyfishProps = LivelyJelly & { style: PixelJellyfishStyle; paused?: boolean; height?: number };

export function PixelJellyfish({ style, mood, paused = false, height, look, wrap, onPoke }: PixelJellyfishProps) {
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
  }, [wrap]);

  useLayoutEffect(() => {
    renderer.current?.update({ style, mood, paused, still, lookX: look.x, lookY: look.y });
  }, [style, mood, paused, still, look.x, look.y]);

  return (
    <span
      ref={wrap}
      className={onPoke ? "center-jelly center-jelly--pixel center-jelly--lively" : "center-jelly center-jelly--pixel"}
      data-mood={mood}
      data-pixel-style={style}
      style={height === undefined ? undefined : ({ "--center-jelly-height": `${height}px` } as CSSProperties)}
      aria-hidden="true"
      onClick={onPoke}
    >
      <canvas ref={canvas} />
    </span>
  );
}
