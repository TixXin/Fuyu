import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { Magnifier } from "../../features/screenshot/Magnifier";
import { cancelScreenshot, copyScreenshot } from "../../features/screenshot/api";
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
  type Point,
  type Size,
} from "../../features/screenshot/selection";
import { layersAt, layersKey, stepLayer } from "../../features/screenshot/targets";
import { loadSettings } from "../../features/appearance/storage";
import { useTranslation } from "../../i18n";
import { getErrorMessage } from "../../utils/error";
import { pictureContext, useScreenshotFrame } from "./useScreenshotFrame";
import { useSelection } from "./useSelection";
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
 * is outlined (the wheel steps out to its parents and back) and a click selects it. Enter or a
 * double click copies, Esc or a right click with nothing
 * selected leaves, C copies the colour under the pointer.
 */
export function ScreenshotOverlay() {
  const t = useTranslation().screenshot;
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

  const pixel = pointer && bounds ? pixelAt(pointer, bounds) : null;
  const color = pixel ? colorAt(canvasRef.current, pixel) : null;
  // Until a region is chosen, the window or control under the pointer is what a click takes.
  const choosing = !(selection && isSelection(selection));
  const layers = choosing && pixel && bounds ? layersAt(targets, pixel, bounds) : [];
  const key = layersKey(layers);
  const target = layers[Math.min(level.key === key ? level.value : 0, layers.length - 1)] ?? null;
  useEffect(() => {
    hovered.current = target;
  });

  const copy = useCallback(() => {
    if (!selection) return;
    copyScreenshot(selection).catch((error: unknown) => setNotice(getErrorMessage(error)));
  }, [selection]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") void cancelScreenshot();
      else if (event.key === "Enter") copy();
      else if ((event.key === "c" || event.key === "C") && !event.ctrlKey && color) {
        void navigator.clipboard.writeText(color).then(() => setNotice(t.colorCopied(color)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [color, copy, t]);

  useEffect(() => setNotice(null), [session?.id]);

  const onContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    if (selection) setSelection(null);
    else void cancelScreenshot();
  };

  const onWheel = (event: React.WheelEvent) => {
    if (layers.length > 1) setLevel({ key, value: stepLayer(level.key === key ? level.value : 0, event.deltaY, layers.length) });
  };

  const area = selection ? toCss(selection, scale) : null;
  const outline = !selection && !dragging && target ? toCss(target, scale) : null;
  const grabbed = selection && pointer && !dragging ? hitTest(selection, pointer, 6 * scale) : null;
  const cursor = dragging === "move" || grabbed === "inside" ? "move" : grabbed ? handleCursor(grabbed) : "crosshair";
  const cssPointer = pointer ? { x: pointer.x / scale, y: pointer.y / scale } : null;
  const shown = selection ?? target;
  const lines = [pixel ? `${pixel.x}, ${pixel.y}` : "", shown ? `${shown.width} × ${shown.height}` : "", t.copyColorHint].filter(Boolean);

  return (
    <div
      className="screenshot-overlay"
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onWheel={onWheel}
      onDoubleClick={() => grabbed === "inside" && copy()}
      onContextMenu={onContextMenu}
    >
      <canvas ref={canvasRef} className="screenshot-overlay__picture" />
      {area ? (
        <div className="screenshot-overlay__selection" style={{ left: area.x, top: area.y, width: area.width, height: area.height }}>
          {!dragging && HANDLES.map((handle) => {
            const at = handlePosition({ x: 0, y: 0, width: area.width, height: area.height }, handle);
            return <span key={handle} className="screenshot-overlay__handle" style={{ left: at.x, top: at.y }} />;
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
        ready && <div key={session?.id} className="screenshot-overlay__dim" />
      )}
      {!area && ready && session?.underPointer && <div className="screenshot-overlay__hint">{t.selectHint}</div>}
      {area && !dragging && (
        <div
          className="screenshot-overlay__toolbar"
          style={{
            right: Math.max(4, view.width - area.x - area.width),
            // Below the selection, or above it when there is no room below; inside it when neither fits.
            ...(area.y + area.height + 48 <= view.height ? { top: area.y + area.height + 8 }
              : area.y >= 48 ? { bottom: view.height - area.y + 8 }
              : { bottom: view.height - area.y - area.height + 8 }),
          }}
          role="toolbar"
          aria-label={t.toolbar}
          onPointerDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <button type="button" className="screenshot-overlay__button" aria-label={t.cancel} title={t.cancel} onClick={() => void cancelScreenshot()}>
            <X size={18} />
          </button>
          <button type="button" className="screenshot-overlay__button screenshot-overlay__button--primary" aria-label={t.copy} title={t.copy} onClick={copy}>
            <Check size={18} />
          </button>
          {notice && <span className="screenshot-overlay__notice">{notice}</span>}
        </div>
      )}
      {!area && notice && <div className="screenshot-overlay__hint">{notice}</div>}
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
      {ready && pixel && cssPointer && color && dragging !== "move" && (
        <Magnifier picture={canvasRef.current} pixel={pixel} pointer={cssPointer} view={view} color={color} lines={lines} />
      )}
    </div>
  );
}
