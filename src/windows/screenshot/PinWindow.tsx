import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type WheelEvent } from "react";
import { Menu } from "@tauri-apps/api/menu";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { closeAllPins, closePin, copyPin, getPinImage, pinReady, savePin, setPinClickThrough, togglePins, zoomPin } from "../../features/screenshot/api";
import { nextOpacity, nextScale } from "../../features/screenshot/pin";
import { useErrorText, useTranslation } from "../../i18n";
import { getErrorMessage } from "../../utils/error";
import "./PinWindow.css";

const NOTICE_MS = 1600;

function pictureSize() {
  const params = new URLSearchParams(window.location.search);
  return { width: Number(params.get("width")) || 1, height: Number(params.get("height")) || 1 };
}

/**
 * A pin (`?window=pin`, label `pin-<n>`): a screenshot kept on top of everything. Drag to move it,
 * the wheel zooms about the pointer, Ctrl + wheel fades it; the right-click menu copies, saves,
 * makes it click-through or closes it. Esc closes it, Ctrl+C / Ctrl+S copy and save, T hides all
 * pins (T on the island shows them again).
 */
export function PinWindow() {
  const t = useTranslation().screenshot;
  const errorText = useErrorText();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const [opacity, setOpacity] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const { width, height } = pictureSize();
    let cancelled = false;
    getPinImage()
      .then((buffer) => {
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(buffer), width, height), 0, 0);
        return pinReady();
      })
      .catch((error: unknown) => console.error("Failed to show the pin", getErrorMessage(error)));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const report = useCallback((error: unknown) => setNotice(errorText(error)), [errorText]);
  const copy = useCallback(() => copyPin().then(() => setNotice(t.pinCopied), report), [report, t]);
  const save = useCallback(() => savePin({ folderName: t.saveFolderName }).then((path) => setNotice(t.saved(path)), report), [report, t]);
  const zoom = useCallback((next: number, anchor = { x: 0.5, y: 0.5 }) => {
    setScale(next);
    zoomPin(next, anchor).catch(report);
  }, [report]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const ctrl = event.ctrlKey || event.metaKey;
      const letter = event.key.toLowerCase();
      if (event.key === "Escape") void closePin();
      else if (ctrl && letter === "c") void copy();
      else if (ctrl && letter === "s") {
        event.preventDefault();
        void save();
      } else if (!ctrl && letter === "t") void togglePins();
      else if (ctrl && event.key === "0") zoom(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [copy, save, zoom]);

  const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey) {
      setOpacity((current) => nextOpacity(current, event.deltaY));
      return;
    }
    zoom(nextScale(scale, event.deltaY), { x: event.clientX / window.innerWidth, y: event.clientY / window.innerHeight });
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button === 0) void getCurrentWindow().startDragging();
  };

  const onContextMenu = async (event: MouseEvent) => {
    event.preventDefault();
    const menu = await Menu.new({
      items: [
        { text: t.pinMenu.copy, action: () => void copy() },
        { text: t.pinMenu.save, action: () => void save() },
        { text: t.pinMenu.actualSize, enabled: scale !== 1, action: () => zoom(1) },
        { item: "Separator" },
        { text: t.pinMenu.clickThrough, action: () => void setPinClickThrough(true).catch(report) },
        { text: t.pinMenu.hideAll, action: () => void togglePins() },
        { item: "Separator" },
        { text: t.pinMenu.close, action: () => void closePin() },
        { text: t.pinMenu.closeAll, action: () => void closeAllPins() },
      ],
    });
    await menu.popup().catch(report);
  };

  return (
    <div className="pin-window" onPointerDown={onPointerDown} onWheel={onWheel} onContextMenu={(event) => void onContextMenu(event)}>
      <canvas ref={canvasRef} className="pin-window__picture" style={{ opacity }} />
      {notice && <div className="pin-window__notice">{notice}</div>}
    </div>
  );
}
