import { useEffect, useRef, type PointerEvent } from "react";
import { annotationAt } from "../../features/screenshot/annotationEdit";
import { textSize, type Annotation } from "../../features/screenshot/annotations";
import { drawAnnotations } from "../../features/screenshot/drawAnnotations";
import type { Point, Size } from "../../features/screenshot/selection";
import { useTranslation } from "../../i18n";
import { AnnotationSelectionBox } from "./AnnotationSelectionBox";
import { AnnotationTextInput } from "./AnnotationTextInput";
import type { Annotations } from "./useAnnotations";
import type { AnnotationSelect } from "./useAnnotationSelect";

export function PinAnnotator({ picture, size, scale, annotations, select }: { picture: HTMLImageElement | null; size: Size; scale: number; annotations: Annotations; select: AnnotationSelect }) {
  const t = useTranslation().screenshot;
  const canvas = useRef<HTMLCanvasElement>(null);
  const editingItem = annotations.editing?.item;
  const shown: readonly Annotation[] = editingItem ? select.items.filter((item) => item !== editingItem) : select.items;
  const { draft } = annotations;

  useEffect(() => {
    const layer = canvas.current;
    const context = layer?.getContext("2d");
    if (!layer || !context) return;
    if (layer.width !== size.width || layer.height !== size.height) {
      layer.width = size.width;
      layer.height = size.height;
    }
    context.clearRect(0, 0, layer.width, layer.height);
    drawAnnotations(context, draft ? [...shown, draft] : shown, picture, null);
  }, [picture, size.width, size.height, shown, draft]);

  const at = (event: { clientX: number; clientY: number }): Point => {
    const rect = canvas.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return { x: ((event.clientX - rect.left) * size.width) / rect.width, y: ((event.clientY - rect.top) * size.height) / rect.height };
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.button !== 0 || annotations.editing) return;
    const point = at(event);
    if (annotations.tool) annotations.begin(point);
    else if (!select.pick(point, true)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const point = at(event);
    annotations.extend(point, event.shiftKey);
    select.move(point);
  };

  const onPointerUp = () => {
    if (!select.end()) annotations.finish();
  };

  const hover = !annotations.tool ? null : annotations.tool === "text" ? "text" : "crosshair";

  return (
    <div
      className="pin-window__annotator"
      style={{ cursor: hover ?? "default" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={(event) => {
        event.stopPropagation();
        const hit = annotations.tool ? null : annotationAt(annotations.items, at(event), 4 * scale);
        if (hit?.kind === "text") annotations.editText(hit);
      }}
    >
      <canvas ref={canvas} className="pin-window__layer" />
      {select.selected && select.selected !== editingItem && <AnnotationSelectionBox item={select.selected} scale={scale} showHandles={!select.dragging} />}
      {annotations.editing && (
        <AnnotationTextInput
          key={`${annotations.editing.at.x},${annotations.editing.at.y}`}
          at={{ x: annotations.editing.at.x / scale, y: annotations.editing.at.y / scale }}
          initial={editingItem?.text}
          color={editingItem?.color ?? annotations.style.color}
          size={editingItem ? editingItem.size / scale : textSize(annotations.style.level, 1)}
          placeholder={t.textPlaceholder}
          onCommit={annotations.commitText}
          onCancel={annotations.cancelText}
        />
      )}
    </div>
  );
}
