import { useEffect, useRef, type RefObject } from "react";
import type { Annotation } from "../../features/screenshot/annotations";
import { drawAnnotations } from "../../features/screenshot/drawAnnotations";
import type { PixelRect, Size } from "../../features/screenshot/selection";

/**
 * The annotations over the frozen picture, at the picture's own resolution (so lines stay sharp
 * on a high-DPI monitor) and clipped to the selection. Redrawn whenever they change.
 */
export function AnnotationLayer({
  picture,
  bounds,
  items,
  draft,
  selection,
}: {
  picture: RefObject<HTMLCanvasElement | null>;
  bounds: Size;
  items: readonly Annotation[];
  draft: Annotation | null;
  selection: PixelRect | null;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const layer = canvas.current;
    const context = layer?.getContext("2d");
    if (!layer || !context) return;
    if (layer.width !== bounds.width || layer.height !== bounds.height) {
      layer.width = bounds.width;
      layer.height = bounds.height;
    }
    context.clearRect(0, 0, layer.width, layer.height);
    if (!selection) return;
    drawAnnotations(context, draft ? [...items, draft] : items, picture.current, selection);
  }, [picture, bounds.width, bounds.height, items, draft, selection]);

  return <canvas ref={canvas} className="screenshot-overlay__annotations" />;
}
