import { useCallback, useEffect, useMemo, useState } from "react";
import { edgesIn, type Picture } from "../../features/screenshot/picture";
import type { Point } from "../../features/screenshot/selection";

const KEY = "m";

export function useMeasure(picture: Picture | null, pixel: Point | null, enabled: boolean) {
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
    () => (held && picture && !from && x !== undefined && y !== undefined ? edgesIn(picture, { x, y }) : null),
    [held, from, x, y, picture],
  );

  const begin = useCallback((point: Point) => {
    setFrom(point);
    setDragging(true);
  }, []);
  const end = useCallback(() => setDragging(false), []);

  const active = held && enabled;
  return { active, edges, from: active ? from : null, dragging: active && dragging, begin, end };
}
