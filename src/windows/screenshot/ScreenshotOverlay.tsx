import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Magnifier } from "../../features/screenshot/Magnifier";
import { annotationArea, autoMosaicAt, textSize } from "../../features/screenshot/annotations";
import { annotationAt } from "../../features/screenshot/annotationEdit";
import { cancelScreenshot, findScreenshotWords, finishScreenshot, quickAction, type ScreenshotAction } from "../../features/screenshot/api";
import { colorAt } from "../../features/screenshot/picture";
import { newMosaics, redactionRects } from "../../features/screenshot/redact";
import { composeArea } from "../../features/screenshot/drawAnnotations";
import {
  HANDLES,
  handleCursor,
  handlePosition,
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
import { loadSettings } from "../../lib/settings/storage";
import { saveFolderOf } from "../../features/screenshot/settings";
import { loadScreenshotSettings } from "../../features/screenshot/storage";
import { useErrorText, useTranslation } from "../../i18n";
import { AnnotationLayer } from "./AnnotationLayer";
import { AnnotationSelectionBox } from "./AnnotationSelectionBox";
import { AnnotationTextInput } from "./AnnotationTextInput";
import { IconButtonTooltip } from "../../components/IconButtonTooltip";
import { LongShotBar } from "./LongShotBar";
import { MeasureLayer } from "./MeasureLayer";
import { ScreenshotToolbar } from "./ScreenshotToolbar";
import { useLongShot } from "./useLongShot";
import { useAnnotations } from "./useAnnotations";
import { useAnnotationSelect } from "./useAnnotationSelect";
import { useMeasure } from "./useMeasure";
import { useScreenshotFrame } from "./useScreenshotFrame";
import { capturePointer, GRAB, useSelection, type PointerCoords } from "./useSelection";
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

export function ScreenshotOverlay() {
  const t = useTranslation().screenshot;
  const errorText = useErrorText();
  const { session, ready, picture, canvasRef } = useScreenshotFrame();
  const drawn = picture !== null;
  const view = useViewSize();
  const bounds = session && ready ? { width: session.width, height: session.height } : null;
  const scale = bounds ? pixelScale(bounds, view) : 1;
  const { selection, setSelection, pointer, dragging, hovered, onPointerDown, onPointerMove, onPointerUp, onPointerLeave } = useSelection(session, bounds, scale);
  const [notice, setNotice] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [gif, setGif] = useState(false);
  const targets = useTargets(ready ? session?.id ?? null : null);
  const [level, setLevel] = useState({ key: "", value: 0 });
  const sessionId = session?.id;
  const guides = useMemo(() => (sessionId === undefined ? false : loadSettings().screenshotGuides), [sessionId]);
  const annotations = useAnnotations(sessionId, scale);
  const select = useAnnotationSelect(annotations, scale);
  const long = useLongShot(sessionId, t.saveFolderName);

  const pixel = pointer && bounds ? pixelAt(pointer, bounds) : null;
  const color = pixel && picture ? colorAt(picture, pixel) : null;
  const measure = useMeasure(picture, pixel, ready && !leaving && !long.active && !annotations.editing && !dragging && !annotations.drafting);
  const chosen = selection && isSelection(selection) ? selection : null;
  const choosing = chosen === null;
  const layers = choosing && pixel && bounds ? layersAt(targets, pixel, bounds) : [];
  const key = layersKey(layers);
  const target = layers[Math.min(level.key === key ? level.value : 0, layers.length - 1)] ?? null;
  useEffect(() => {
    hovered.current = target;
  });

  const { reset: resetAnnotations } = annotations;
  useEffect(() => {
    if (choosing) resetAnnotations();
  }, [choosing, resetAnnotations]);

  const { items } = annotations;
  const finish = useCallback((action: ScreenshotAction) => {
    const picture = canvasRef.current;
    if (!chosen || !picture || (items.length > 0 && !drawn)) return;
    const area = annotationArea(items, chosen);
    const image = area ? composeArea(picture, area, chosen, items) : null;
    const patch = area && image ? { at: area, image } : null;
    const save = action === "save" ? { folder: saveFolderOf(loadScreenshotSettings()), folderName: t.saveFolderName }
      : action === "record" ? { folderName: t.recordFolderName, record: { ...loadScreenshotSettings().record, format: gif ? "gif" as const : "mp4" as const } } : undefined;
    if (action === "pin") setLeaving(true);
    finishScreenshot(chosen, patch, action, save).catch((error: unknown) => {
      setLeaving(false);
      setNotice(errorText(error));
    });
  }, [chosen, items, drawn, canvasRef, errorText, gif, t]);
  const copy = useCallback(() => finish("copy"), [finish]);
  const { addMany } = annotations;
  const redact = useCallback(() => {
    if (!chosen) return;
    setNotice(t.redacting);
    findScreenshotWords(chosen)
      .then((lines) => {
        const added = newMosaics(redactionRects(Array.isArray(lines) ? lines : [], chosen), items);
        addMany(added);
        setNotice(added.length > 0 ? t.redacted(added.length) : t.nothingToRedact);
      })
      .catch((error: unknown) => setNotice(errorText(error)));
  }, [chosen, items, addMany, errorText, t]);

  const quickMode = quickAction(session?.mode);
  const quick = quickMode !== null;
  const doneFor = useRef<number | null>(null);
  useEffect(() => {
    if (!quickMode || !chosen || dragging || sessionId === undefined || doneFor.current === sessionId) return;
    doneFor.current = sessionId;
    finish(quickMode);
  }, [quickMode, chosen, dragging, sessionId, finish]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (long.active || event.target instanceof HTMLTextAreaElement || annotations.editing) return;
      if (select.selected && (event.key === "Delete" || event.key === "Backspace" || event.key === "Escape")) {
        event.preventDefault();
        if (event.key === "Escape") select.clear();
        else select.remove();
        return;
      }
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
      else if (letter === "g" && !ctrl && quickMode === "record") setGif((value) => !value);
      else if (letter === "f" && !ctrl && quickMode === "record" && session && ready) setSelection({ x: 0, y: 0, width: session.width, height: session.height });
      else if (letter === "t" && !ctrl && chosen) finish("pin");
      else if (letter === "c" && !ctrl && color) {
        void navigator.clipboard.writeText(color).then(() => setNotice(t.colorCopied(color)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [annotations, select, chosen, color, copy, finish, long.active, quickMode, ready, session, setSelection, t]);

  useEffect(() => {
    setNotice(null);
    setLeaving(false);
    setGif(loadScreenshotSettings().record.format === "gif");
  }, [sessionId]);

  const at = (event: PointerCoords) => toPixels({ x: event.clientX, y: event.clientY }, scale);
  const grabbedAt = (point: Point) => (chosen ? hitTest(chosen, point, GRAB * scale) : null);
  const moveFrameRef = useRef(0);
  const pendingMoveRef = useRef<PointerCoords | null>(null);
  const latestMoveRef = useRef<(coords: PointerCoords) => void>(() => {});
  latestMoveRef.current = (coords: PointerCoords) => {
    onPointerMove(coords);
    const point = toPixels({ x: coords.clientX, y: coords.clientY }, scale);
    annotations.extend(point);
    select.move(point);
  };

  const flushMove = () => {
    if (moveFrameRef.current !== 0) {
      window.cancelAnimationFrame(moveFrameRef.current);
      moveFrameRef.current = 0;
    }
    const coords = pendingMoveRef.current;
    if (coords) {
      pendingMoveRef.current = null;
      latestMoveRef.current(coords);
    }
  };

  useEffect(() => () => {
    if (moveFrameRef.current !== 0) window.cancelAnimationFrame(moveFrameRef.current);
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (leaving) return;
    flushMove();
    if (measure.active && event.button === 0 && bounds) {
      capturePointer(event);
      measure.begin(pixelAt(at(event), bounds));
      return;
    }
    if (!annotations.tool && chosen && event.button === 0) {
      const spot = autoMosaicAt(annotations.items, at(event));
      if (spot) {
        annotations.remove(spot);
        return;
      }
      if (select.pick(at(event), grabbedAt(at(event)) === "inside")) {
        capturePointer(event);
        return;
      }
    }
    if (annotations.tool && chosen && event.button === 0) {
      const point = at(event);
      const grab = grabbedAt(point);
      if (grab === "inside") {
        capturePointer(event);
        annotations.begin(point);
        return;
      }
      if (grab === null) return;
    }
    onPointerDown(event);
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (leaving) return;
    const coords = { clientX: event.clientX, clientY: event.clientY };
    if (!dragging && !annotations.drafting && !select.dragging) {
      latestMoveRef.current(coords);
      return;
    }
    pendingMoveRef.current = coords;
    if (moveFrameRef.current === 0) {
      moveFrameRef.current = window.requestAnimationFrame(() => {
        moveFrameRef.current = 0;
        const next = pendingMoveRef.current;
        if (next) {
          pendingMoveRef.current = null;
          latestMoveRef.current(next);
        }
      });
    }
  };

  const handlePointerUp = () => {
    flushMove();
    if (measure.dragging) {
      measure.end();
      return;
    }
    if (!select.end() && !annotations.finish()) onPointerUp();
  };

  const handlePointerLeave = () => {
    flushMove();
    onPointerLeave();
  };

  const onContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    if (annotations.editing) return;
    if (select.selected) select.clear();
    else if (annotations.tool) annotations.clearTool();
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
  const picking = !annotations.tool && !measure.active && chosen && pointer && !dragging ? select.hover(pointer, grabbed === "inside") : null;
  const cursor = measure.active ? "crosshair" : picking ?? (annotations.tool && grabbed === "inside" ? drawingCursor
    : dragging === "move" || grabbed === "inside" ? "move" : grabbed ? handleCursor(grabbed) : "crosshair");
  const editingItem = annotations.editing?.item;
  const cssPointer = pointer ? { x: pointer.x / scale, y: pointer.y / scale } : null;
  const shown = selection ?? target;
  const lines = [pixel ? `${pixel.x}, ${pixel.y}` : "", shown ? `${shown.width} × ${shown.height}` : "", t.copyColorHint, t.measureHint].filter(Boolean);

  return (
    <div
      className={`screenshot-overlay${long.active ? " screenshot-overlay--long" : ""}`}
      style={{ cursor }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onWheel={onWheel}
      onDoubleClick={(event) => {
        if (annotations.tool || measure.active || grabbed !== "inside") return;
        const hit = annotationAt(annotations.items, at(event), 4 * scale);
        if (hit?.kind === "text") annotations.editText(hit);
        else copy();
      }}
      onContextMenu={onContextMenu}
    >
      <IconButtonTooltip scope=".screenshot-overlay" delay={200} />
      <canvas ref={canvasRef} className="screenshot-overlay__picture" />
      {bounds && !long.active && <AnnotationLayer picture={canvasRef} bounds={bounds} items={editingItem ? select.items.filter((item) => item !== editingItem) : select.items} draft={annotations.draft} selection={chosen} />}
      {long.active && !long.mine ? (
        <div className="screenshot-overlay__dim" />
      ) : long.mine && area ? (
        <div className="screenshot-overlay__selection screenshot-overlay__selection--long" style={{ left: area.x, top: area.y, width: area.width, height: area.height }}>
          <span className={`screenshot-overlay__size${area.y < 28 ? " screenshot-overlay__size--inside" : ""}`}>
            {t.long.size(selection?.width ?? 0, long.progress?.height ?? selection?.height ?? 0)}
          </span>
        </div>
      ) : area ? (
        <div className="screenshot-overlay__selection" style={{ left: area.x, top: area.y, width: area.width, height: area.height }}>
          {!dragging && !annotations.drafting && !select.dragging && !leaving && HANDLES.map((handle) => {
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
        ready && <div key={sessionId} className="screenshot-overlay__dim" />
      )}
      {!area && !long.active && ready && session?.underPointer && <div className="screenshot-overlay__hint">{quickMode === "record" && gif ? t.recordGifHint : quickMode ? t.quickHints[quickMode] : t.selectHint}</div>}
      {long.mine && area && <LongShotBar area={area} view={view} long={long} />}
      {select.selected && !leaving && !long.active && select.selected !== editingItem && <AnnotationSelectionBox item={select.selected} scale={scale} showHandles={!select.dragging} />}
      {area && chosen && !dragging && !annotations.drafting && !select.dragging && !quick && !leaving && !long.active && (
        <ScreenshotToolbar area={area} view={view} annotations={annotations} select={select} notice={notice} onCancel={() => void cancelScreenshot()} onFinish={finish} onRedact={redact} />
      )}
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
      {(!area || quick) && notice && <div className="screenshot-overlay__hint">{notice}</div>}
      {guides && !leaving && !long.active && ready && cssPointer && (choosing || dragging === "draw" || dragging === "resize") && (
        <>
          <div className="screenshot-overlay__guide screenshot-overlay__guide--h" style={{ top: cssPointer.y }} />
          <div className="screenshot-overlay__guide screenshot-overlay__guide--v" style={{ left: cssPointer.x }} />
        </>
      )}
      {guides && area && !leaving && (
        <>
          <div className="screenshot-overlay__guide screenshot-overlay__guide--h" style={{ top: area.y }} />
          <div className="screenshot-overlay__guide screenshot-overlay__guide--h" style={{ top: area.y + area.height - 1 }} />
          <div className="screenshot-overlay__guide screenshot-overlay__guide--v" style={{ left: area.x }} />
          <div className="screenshot-overlay__guide screenshot-overlay__guide--v" style={{ left: area.x + area.width - 1 }} />
        </>
      )}
      {measure.active && pixel && <MeasureLayer edges={measure.edges} from={measure.from} to={pixel} scale={scale} />}
      {drawn && pixel && cssPointer && color && dragging !== "move" && !annotations.tool && !leaving && !long.active && (
        <Magnifier picture={canvasRef.current} pixel={pixel} pointer={cssPointer} view={view} color={color} lines={lines} />
      )}
    </div>
  );
}
