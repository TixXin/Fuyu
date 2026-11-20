import { useCallback, useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { closePin, pinReady, setPinOpacity } from "../../features/screenshot/api";
import { toolForKey } from "../../features/screenshot/annotations";
import { isDoubleClick, nextOpacity, nextScale, pinKeyCommand } from "../../features/screenshot/pin";
import { useErrorText } from "../../i18n";
import { MOTION_BASE_MS } from "../../lib/theme/motionTokens";
import { getErrorMessage } from "../../utils/error";
import { PinAnnotateBar } from "./PinAnnotateBar";
import { PinAnnotator } from "./PinAnnotator";
import { usePinActions } from "./usePinActions";
import { usePinEditing } from "./usePinEditing";
import { usePinPicture } from "./usePinPicture";
import "./ScreenshotOverlay.css";
import "./ScreenshotToolbar.css";
import "./PinWindow.css";

const NOTICE_MS = 1600;

export function PinWindow() {
  const errorText = useErrorText();
  const { info, url } = usePinPicture();
  const frameRef = useRef<HTMLDivElement>(null);
  const pictureRef = useRef<HTMLImageElement>(null);
  const lastPress = useRef<{ at: number; x: number; y: number } | null>(null);
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const [fade, setFade] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const opacity = fade ?? info?.opacity ?? 1;

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
  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => void closePin(), MOTION_BASE_MS);
  }, []);
  const edit = usePinEditing(info, frameRef, pictureRef, report);
  const actions = usePinActions(setNotice, report, close, edit.start);
  const { annotations, select } = edit;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLTextAreaElement) return;
      const ctrl = event.ctrlKey || event.metaKey;
      if (!edit.editing) {
        const command = pinKeyCommand(event.key, ctrl);
        if (!command) return;
        event.preventDefault();
        actions.run(command);
        return;
      }
      const letter = event.key.toLowerCase();
      if (annotations.editing) return;
      if (ctrl && letter === "z") {
        event.preventDefault();
        if (event.shiftKey) annotations.redo();
        else annotations.undo();
      } else if (ctrl && letter === "y") {
        event.preventDefault();
        annotations.redo();
      } else if (select.selected && (event.key === "Delete" || event.key === "Backspace")) select.remove();
      else if (event.key === "Escape") {
        if (select.selected) select.clear();
        else edit.cancel();
      } else if (event.key === "Enter") edit.done();
      else if (!ctrl && !event.altKey) {
        const tool = toolForKey(event.key);
        if (tool) {
          select.clear();
          annotations.chooseTool(tool);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, annotations, edit, select]);

  const onWheel = (event: WheelEvent) => {
    if (edit.editing || actions.collapsed) return;
    if (event.ctrlKey) {
      const next = nextOpacity(opacity, event.deltaY);
      setFade(next);
      setPinOpacity(next).catch(report);
      return;
    }
    const frame = frameRef.current?.getBoundingClientRect();
    const anchor = frame && frame.width > 0 && frame.height > 0
      ? { x: (event.clientX - frame.left) / frame.width, y: (event.clientY - frame.top) / frame.height }
      : undefined;
    actions.zoom(nextScale(actions.scale, event.deltaY), anchor);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const press = { at: event.timeStamp, x: event.screenX, y: event.screenY };
    const twice = !edit.editing && isDoubleClick(lastPress.current, press);
    lastPress.current = twice ? null : press;
    if (twice) actions.run("collapse");
    else void getCurrentWindow().startDragging();
  };

  const editing = edit.editing;
  const state = `${closing ? " pin-window--closing" : shown ? " pin-window--shown" : ""}${actions.collapsed ? " pin-window--collapsed" : ""}${editing ? " pin-window--editing" : ""}`;
  return (
    <div
      className={`pin-window${state}`}
      onPointerDown={onPointerDown}
      onWheel={onWheel}
      onContextMenu={(event) => {
        event.preventDefault();
        if (!editing) void actions.openMenu();
      }}
    >
      {info && url && (
        <div ref={frameRef} className="pin-window__frame" style={editing ? { opacity, width: editing.css.width, height: editing.css.height } : { opacity }}>
          <img ref={pictureRef} className="pin-window__picture" src={url} alt="" draggable={false} onLoad={onLoaded} />
          {editing && info && <PinAnnotator picture={pictureRef.current} size={info} scale={editing.scale} annotations={annotations} select={select} />}
        </div>
      )}
      {editing && <div className="pin-window__bar" style={{ top: `calc(var(--pin-margin) + ${editing.css.height + 6}px)` }}><PinAnnotateBar annotations={annotations} select={select} onDone={edit.done} onCancel={edit.cancel} /></div>}
      {notice && <div className="pin-window__notice">{notice}</div>}
    </div>
  );
}
