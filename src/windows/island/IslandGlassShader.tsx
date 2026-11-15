import { useEffect, useRef } from "react";
import type { GlassPalette } from "../../features/appearance/glassPalette";
import { createGlassShader, type GlassShader } from "./glassShader";

const FRAME_MS = 1000 / 30;

export function IslandGlassShader({ palette, paused, strength, onFail }: {
  palette: GlassPalette;
  paused: boolean;
  strength: number;
  onFail: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shaderRef = useRef<GlassShader | null>(null);
  const timeRef = useRef(0);
  const opacity = Math.min(1, strength / 0.7) * 0.8;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const shader = createGlassShader(canvas);
    if (!shader) {
      onFail();
      return;
    }
    shaderRef.current = shader;
    const lost = (event: Event) => {
      event.preventDefault();
      onFail();
    };
    canvas.addEventListener("webglcontextlost", lost);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      shader.dispose();
      shaderRef.current = null;
    };
  }, [onFail]);

  useEffect(() => {
    const shader = shaderRef.current;
    if (!shader) return;
    if (paused) {
      shader.draw(timeRef.current, palette, opacity);
      return;
    }
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      frame = window.requestAnimationFrame(tick);
      if (now - last < FRAME_MS) return;
      timeRef.current += (now - last) / 1000;
      last = now;
      shader.draw(timeRef.current, palette, opacity);
    };
    shader.draw(timeRef.current, palette, opacity);
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [paused, palette, opacity]);

  return <canvas ref={canvasRef} className="island__glass-shader" />;
}
