import { annotationHandles } from "../../features/screenshot/annotationEdit";
import { annotationBounds, type Annotation } from "../../features/screenshot/annotations";
import { toCss } from "../../features/screenshot/selection";

export function AnnotationSelectionBox({ item, scale, showHandles }: { item: Annotation; scale: number; showHandles: boolean }) {
  const box = toCss(annotationBounds(item), scale);
  return (
    <>
      <div className="screenshot-overlay__picked" style={{ left: box.x, top: box.y, width: box.width, height: box.height }} />
      {showHandles && annotationHandles(item).map(({ handle, at }) => (
        <span key={handle} className="screenshot-overlay__picked-handle" style={{ left: at.x / scale, top: at.y / scale }} />
      ))}
    </>
  );
}
