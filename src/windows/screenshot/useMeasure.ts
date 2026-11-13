import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import { edgesAround, type Edges } from "../../features/screenshot/measure";
import type { Point } from "../../features/screenshot/selection";
import { pictureContext } from "./useScreenshotFrame";

const KEY = "m";

function edgesIn(canvas: HTMLCanvasElement | null, pixel: Point): Edges | null {
  const context = pictureContext(canvas);
  if (!canvas || !context || canvas.width === 0 || canvas.height === 0) return null;
  const row = context.getImageData(0, pixel.y, canvas.width, 1).data;
  const column = context.getImageData(pixel.x, 0, 1, canvas.height).data;
  return edgesAround(row, column, pixel);
}

export function useMeasure(picture: RefObject<HTMLCanvasElement | null>, drawn: boolean, pixel: Point | null, enabled: boolean) {
  const [held, setHeld] = useState(false);
  const [from, setFrom] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setHeld(false);
      setFrom(null);
      setDragging(false);
      return;
    }
    const onDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLTextAreaElement || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.toLowerCase() === KEY) setHeld(true);
    };
    const onUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== KEY) return;
      setHeld(false);
      setFrom(null);
      setDragging(false);
    };
    const onBlur = () => {
      setHeld(false);
      setFrom(null);
      setDragging(false);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [enabled]);

  const x = pixel?.x;
  const y = pixel?.y;
  const edges = useMemo(
    () => (held && drawn && !from && x !== undefined && y !== undefined ? edgesIn(picture.current, { x, y }) : null),
    [held, drawn, from, x, y, picture],
  );

  const begin = useCallback((point: Point) => {
    setFrom(point);
    setDragging(true);
  }, []);
  const end = useCallback(() => setDragging(false), []);

  const active = held && enabled;
  return { active, edges, from: active ? from : null, dragging: active && dragging, begin, end };
}
