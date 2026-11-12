import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Magnifier } from "../../features/screenshot/Magnifier";
import { textSize } from "../../features/screenshot/annotations";
import { cancelScreenshot, finishScreenshot, type ScreenshotAction } from "../../features/screenshot/api";
import { composeSelection } from "../../features/screenshot/drawAnnotations";
import {
  HANDLES,
  handleCursor,
  handlePosition,
  hexColor,
  hitTest,
  isSelection,
  pixelAt,
  pixelScale,
  toCss,
  toPixels,
  type Point,
  type Size,
} from "../../features/screenshot/selection";
import { layersAt, layersKey, stepLayer } from "../../features/screenshot/targets";
import { loadSettings } from "../../features/appearance/storage";
import { useErrorText, useTranslation } from "../../i18n";
import { AnnotationLayer } from "./AnnotationLayer";
import { AnnotationTextInput } from "./AnnotationTextInput";
import { ScreenshotToolbar } from "./ScreenshotToolbar";
import { useAnnotations } from "./useAnnotations";
import { pictureContext, useScreenshotFrame } from "./useScreenshotFrame";
import { capturePointer, GRAB, useSelection } from "./useSelection";
import { useTargets } from "./useTargets";
import "./ScreenshotOverlay.css";

function useViewSize(): Size {
  const [view, setView] = useState<Size>({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const update = () => setView({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return view;
}

function colorAt(canvas: HTMLCanvasElement | null, pixel: Point): string {
  const data = pictureContext(canvas)?.getImageData(pixel.x, pixel.y, 1, 1).data;
  return data ? hexColor(data[0], data[1], data[2]) : "#000000";
}

/**
 * A screenshot overlay (`?window=screenshot`, one per monitor): the frozen picture of its monitor,
 * dimmed outside the selection, the selection's handles and size, a toolbar once it is chosen, and
 * the magnifier by the pointer. Before anything is selected, the window or control under the pointer
 * is outlined (the wheel steps out to its parents and back) and a click selects it. With an
 * annotation tool on, a drag inside the selection draws (its handles still resize it); Ctrl+Z / Ctrl+Y
 * undo and redo. Enter, Ctrl+C or a double click copies, with the annotations; Ctrl+S saves, T pins
 * it to the screen; Esc or a right click with nothing selected leaves, C copies the colour under
 * the pointer. Opened with Ctrl+Shift+2 (mode "copy"), the selection is copied as soon as it is
 * chosen, without the toolbar.
 */
export function ScreenshotOverlay() {
  const t = useTranslation().screenshot;
  const errorText = useErrorText();
  const { session, ready, canvasRef } = useScreenshotFrame();
  const view = useViewSize();
  const bounds = session && ready ? { width: session.width, height: session.height } : null;
  const scale = bounds ? pixelScale(bounds, view) : 1;
  const { selection, setSelection, pointer, dragging, hovered, onPointerDown, onPointerMove, onPointerUp, onPointerLeave } = useSelection(session, bounds, scale);
  const [notice, setNotice] = useState<string | null>(null);
  const targets = useTargets(ready ? session?.id ?? null : null);
  const [level, setLevel] = useState({ key: "", value: 0 });
  const sessionId = session?.id;
  // Read again for each screenshot, so a change in the settings window shows on the next one.
  const guides = useMemo(() => (sessionId === undefined ? false : loadSettings().screenshotGuides), [sessionId]);
  const annotations = useAnnotations(sessionId, scale);

  const pixel = pointer && bounds ? pixelAt(pointer, bounds) : null;
  const color = pixel ? colorAt(canvasRef.current, pixel) : null;
  // Until a region is chosen, the window or control under the pointer is what a click takes.
  const chosen = selection && isSelection(selection) ? selection : null;
  const choosing = chosen === null;
  const layers = choosing && pixel && bounds ? layersAt(targets, pixel, bounds) : [];
  const key = layersKey(layers);
  const target = layers[Math.min(level.key === key ? level.value : 0, layers.length - 1)] ?? null;
  useEffect(() => {
    hovered.current = target;
  });

  // Annotations belong to the selection they were drawn on; a new one starts clean.
  const { reset: resetAnnotations } = annotations;
  useEffect(() => {
    if (choosing) resetAnnotations();
  }, [choosing, resetAnnotations]);

  const { items } = annotations;
  const finish = useCallback((action: ScreenshotAction) => {
    const picture = canvasRef.current;
    const composed = chosen && picture ? composeSelection(picture, chosen, items) : null;
    if (!chosen || !composed) return;
    const save = action === "save" ? { folderName: t.saveFolderName } : undefined;
    finishScreenshot(composed, chosen, action, save).catch((error: unknown) => setNotice(errorText(error)));
  }, [chosen, items, canvasRef, errorText, t]);
  const copy = useCallback(() => finish("copy"), [finish]);

  // Ctrl+Shift+2: copied as soon as a region or target is chosen, once per screenshot.
  const quick = session?.mode === "copy";
  const copiedFor = useRef<number | null>(null);
  useEffect(() => {
    if (!quick || !chosen || dragging || sessionId === undefined || copiedFor.current === sessionId) return;
    copiedFor.current = sessionId;
    copy();
  }, [quick, chosen, dragging, sessionId, copy]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Typing a text annotation: its box has the keys.
      if (event.target instanceof HTMLTextAreaElement || annotations.editing) return;
      const ctrl = event.ctrlKey || event.metaKey;
      const letter = event.key.toLowerCase();
      if (ctrl && letter === "z") {
        event.preventDefault();
        if (event.shiftKey) annotations.redo();
        else annotations.undo();
      } else if (ctrl && letter === "y") {
        event.preventDefault();
        annotations.redo();
      } else if (ctrl && letter === "s") {
        event.preventDefault();
        finish("save");
      } else if (ctrl && letter === "c") {
        event.preventDefault();
        copy();
      } else if (event.key === "Escape") void cancelScreenshot();
      else if (event.key === "Enter") copy();
      else if (letter === "t" && !ctrl && chosen) finish("pin");
      else if (letter === "c" && !ctrl && color) {
        void navigator.clipboard.writeText(color).then(() => setNotice(t.colorCopied(color)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [annotations, chosen, color, copy, finish, t]);

  useEffect(() => setNotice(null), [sessionId]);

  const at = (event: PointerEvent) => toPixels({ x: event.clientX, y: event.clientY }, scale);
  const grabbedAt = (point: Point) => (chosen ? hitTest(chosen, point, GRAB * scale) : null);

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (annotations.tool && chosen && event.button === 0) {
      const point = at(event);
      const grab = grabbedAt(point);
      if (grab === "inside") {
        capturePointer(event);
        annotations.begin(point);
        return;
      }
      // Outside the selection a tool draws nothing; its handles still resize it.
      if (grab === null) return;
    }
    onPointerDown(event);
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    onPointerMove(event);
    annotations.extend(at(event));
  };

  const handlePointerUp = () => {
    if (!annotations.finish()) onPointerUp();
  };

  const onContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    if (annotations.editing) return;
    if (annotations.tool) annotations.clearTool();
    else if (selection) setSelection(null);
    else void cancelScreenshot();
  };

  const onWheel = (event: React.WheelEvent) => {
    if (layers.length > 1) setLevel({ key, value: stepLayer(level.key === key ? level.value : 0, event.deltaY, layers.length) });
  };

  const area = selection ? toCss(selection, scale) : null;
  const outline = !selection && !dragging && target ? toCss(target, scale) : null;
  const grabbed = selection && pointer && !dragging ? hitTest(selection, pointer, GRAB * scale) : null;
  const drawingCursor = annotations.tool === "text" ? "text" : "crosshair";
  const cursor = annotations.tool && grabbed === "inside" ? drawingCursor
    : dragging === "move" || grabbed === "inside" ? "move" : grabbed ? handleCursor(grabbed) : "crosshair";
  const cssPointer = pointer ? { x: pointer.x / scale, y: pointer.y / scale } : null;
  const shown = selection ?? target;
  const lines = [pixel ? `${pixel.x}, ${pixel.y}` : "", shown ? `${shown.width} × ${shown.height}` : "", t.copyColorHint].filter(Boolean);

  return (
    <div
      className="screenshot-overlay"
      style={{ cursor }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={onPointerLeave}
      onWheel={onWheel}
      onDoubleClick={() => !annotations.tool && grabbed === "inside" && copy()}
      onContextMenu={onContextMenu}
    >
      <canvas ref={canvasRef} className="screenshot-overlay__picture" />
      {bounds && <AnnotationLayer picture={canvasRef} bounds={bounds} items={annotations.items} draft={annotations.draft} selection={chosen} />}
      {area ? (
        <div className="screenshot-overlay__selection" style={{ left: area.x, top: area.y, width: area.width, height: area.height }}>
          {!dragging && !annotations.drafting && HANDLES.map((handle) => {
            const spot = handlePosition({ x: 0, y: 0, width: area.width, height: area.height }, handle);
            return <span key={handle} className="screenshot-overlay__handle" style={{ left: spot.x, top: spot.y }} />;
          })}
          <span className={`screenshot-overlay__size${area.y < 28 ? " screenshot-overlay__size--inside" : ""}`}>
            {selection?.width} × {selection?.height}
          </span>
        </div>
      ) : outline && target ? (
        <div className="screenshot-overlay__target" style={{ left: outline.x, top: outline.y, width: outline.width, height: outline.height }}>
          <span className={`screenshot-overlay__size${outline.y < 28 ? " screenshot-overlay__size--inside" : ""}`}>
            {target.width} × {target.height}
          </span>
        </div>
      ) : (
        // Only once the picture is up, and new for each screenshot so it eases in each time; the
        // hidden window's last painted frame then has nothing on it (see session.rs, transparent).
        ready && <div key={sessionId} className="screenshot-overlay__dim" />
      )}
      {!area && ready && session?.underPointer && <div className="screenshot-overlay__hint">{quick ? t.copySelectHint : t.selectHint}</div>}
      {area && chosen && !dragging && !annotations.drafting && !quick && (
        <ScreenshotToolbar area={area} view={view} annotations={annotations} notice={notice} onCancel={() => void cancelScreenshot()} onFinish={finish} />
      )}
      {annotations.editing && (
        <AnnotationTextInput
          key={`${annotations.editing.x},${annotations.editing.y}`}
          at={{ x: annotations.editing.x / scale, y: annotations.editing.y / scale }}
          color={annotations.style.color}
          size={textSize(annotations.style.level, 1)}
          placeholder={t.textPlaceholder}
          onCommit={annotations.commitText}
          onCancel={annotations.cancelText}
        />
      )}
      {(!area || quick) && notice && <div className="screenshot-overlay__hint">{notice}</div>}
      {guides && ready && cssPointer && (choosing || dragging === "draw" || dragging === "resize") && (
        <>
          <div className="screenshot-overlay__guide screenshot-overlay__guide--h" style={{ top: cssPointer.y }} />
          <div className="screenshot-overlay__guide screenshot-overlay__guide--v" style={{ left: cssPointer.x }} />
        </>
      )}
      {guides && area && (
        // The selection's four edges carried across the monitor, on its 1px border.
        <>
          <div className="screenshot-overlay__guide screenshot-overlay__guide--h" style={{ top: area.y }} />
          <div className="screenshot-overlay__guide screenshot-overlay__guide--h" style={{ top: area.y + area.height - 1 }} />
          <div className="screenshot-overlay__guide screenshot-overlay__guide--v" style={{ left: area.x }} />
          <div className="screenshot-overlay__guide screenshot-overlay__guide--v" style={{ left: area.x + area.width - 1 }} />
        </>
      )}
      {/* While annotating the magnifier would only be in the way. */}
      {ready && pixel && cssPointer && color && dragging !== "move" && !annotations.tool && (
        <Magnifier picture={canvasRef.current} pixel={pixel} pointer={cssPointer} view={view} color={color} lines={lines} />
      )}
    </div>
  );
}
