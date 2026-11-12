import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type WheelEvent } from "react";
import { Menu } from "@tauri-apps/api/menu";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  closeAllPins,
  closePin,
  copyPin,
  getPinImage,
  getPinInfo,
  listenPinAssigned,
  pinReady,
  savePin,
  setPinClickThrough,
  togglePins,
  zoomPin,
  type PinInfo,
} from "../../features/screenshot/api";
import { nextOpacity, nextScale } from "../../features/screenshot/pin";
import { useErrorText, useTranslation } from "../../i18n";
import { getErrorMessage } from "../../utils/error";
import "./PinWindow.css";

const NOTICE_MS = 1600;
/** How long the fade-out runs before the window goes (PinWindow.css, pin-window--closing). */
const CLOSE_MS = 140;

/**
 * The picture this page was given: the native side keeps one pin window ready, hidden, and hands
 * it a picture when something is pinned. The PNG is decoded off the main thread before the window
 * shows, so it appears with its picture already drawn.
 */
function usePinPicture() {
  const [info, setInfo] = useState<PinInfo | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    void listenPinAssigned((event) => setInfo(event.payload)).then((unlisten) => {
      if (cancelled) unlisten();
      else stop = unlisten;
    });
    getPinInfo()
      .then((current) => { if (!cancelled && current) setInfo(current); })
      .catch((error: unknown) => console.error("Failed to read the pin", getErrorMessage(error)));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  useEffect(() => {
    if (!info) return;
    let cancelled = false;
    let made: string | null = null;
    getPinImage()
      .then(async (png) => {
        made = URL.createObjectURL(new Blob([png], { type: "image/png" }));
        const image = new Image();
        image.src = made;
        await image.decode();
        if (cancelled) return;
        setUrl(made);
      })
      .catch((error: unknown) => console.error("Failed to show the pin", getErrorMessage(error)));
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [info]);

  return { info, url };
}

/**
 * A pin (`?window=pin`, label `pin-<n>`): a screenshot kept on top of everything. Drag to move it,
 * the wheel zooms about the pointer, Ctrl + wheel fades it; the right-click menu copies, saves,
 * makes it click-through or closes it. Esc closes it, Ctrl+C / Ctrl+S copy and save, T hides all
 * pins (T on the island shows them again). It lifts off the screen as it appears and fades as it
 * closes.
 */
export function PinWindow() {
  const t = useTranslation().screenshot;
  const errorText = useErrorText();
  const { info, url } = usePinPicture();
  const frameRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const [scale, setScale] = useState(1);
  const [opacity, setOpacity] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);

  // The decoded picture is in the <img>: show the window (the screenshot goes a frame later), then
  // lift it. Not from requestAnimationFrame: a hidden WebView may not run it.
  const onLoaded = useCallback(() => {
    pinReady()
      .then(() => setShown(true))
      .catch((error: unknown) => console.error("Failed to show the pin", getErrorMessage(error)));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const report = useCallback((error: unknown) => setNotice(errorText(error)), [errorText]);
  const copy = useCallback(() => copyPin().then(() => setNotice(t.pinCopied), report), [report, t]);
  const save = useCallback(() => savePin({ folderName: t.saveFolderName }).then((path) => setNotice(t.saved(path)), report), [report, t]);
  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => void closePin(), CLOSE_MS);
  }, []);
  const zoom = useCallback((next: number, anchor = { x: 0.5, y: 0.5 }) => {
    setScale(next);
    zoomPin(next, anchor).catch(report);
  }, [report]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const ctrl = event.ctrlKey || event.metaKey;
      const letter = event.key.toLowerCase();
      if (event.key === "Escape") close();
      else if (ctrl && letter === "c") void copy();
      else if (ctrl && letter === "s") {
        event.preventDefault();
        void save();
      } else if (!ctrl && letter === "t") void togglePins();
      else if (ctrl && event.key === "0") zoom(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, copy, save, zoom]);

  const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey) {
      setOpacity((current) => nextOpacity(current, event.deltaY));
      return;
    }
    const frame = frameRef.current?.getBoundingClientRect();
    const anchor = frame && frame.width > 0 && frame.height > 0
      ? { x: (event.clientX - frame.left) / frame.width, y: (event.clientY - frame.top) / frame.height }
      : undefined;
    zoom(nextScale(scale, event.deltaY), anchor);
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
        { text: t.pinMenu.close, action: close },
        { text: t.pinMenu.closeAll, action: () => void closeAllPins() },
      ],
    });
    await menu.popup().catch(report);
  };

  const state = closing ? " pin-window--closing" : shown ? " pin-window--shown" : "";
  return (
    <div className={`pin-window${state}`} onPointerDown={onPointerDown} onWheel={onWheel} onContextMenu={(event) => void onContextMenu(event)}>
      {info && url && (
        <div ref={frameRef} className="pin-window__frame" style={{ opacity }}>
          <img className="pin-window__picture" src={url} alt="" draggable={false} onLoad={onLoaded} />
        </div>
      )}
      {notice && <div className="pin-window__notice">{notice}</div>}
    </div>
  );
}
