import { useCallback, useEffect, useRef, useState } from "react";
import { clipboardPreviewHasPointer, listenClipboardPreviewReport, sendClipboardPreviewCommand, setClipboardPreviewSize } from "./api";
import { PEEK_HOLD_MS, releaseEndsPeek } from "./popupKeys";
import { isPreviewSizeKey, previewCommandForKey } from "./previewCommands";
import type { PopupKeyEvent } from "./useStrayKeys";

const reportError = (action: string) => (error: unknown) => console.error(`Failed to ${action}`, error);

export function useSpacePeek(onClose: () => void, windowed = false, onEdited?: (id: string) => void) {
  const downAt = useRef<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const visitedRef = useRef(false);
  const pinnedRef = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const editedRef = useRef(onEdited);
  editedRef.current = onEdited;
  const [holding, setHolding] = useState(false);
  const [visited, setVisited] = useState(false);

  const stopHolding = useCallback(() => {
    downAt.current = null;
    window.clearTimeout(timer.current);
    setHolding(false);
  }, []);

  const cancel = useCallback(() => {
    stopHolding();
    visitedRef.current = false;
    pinnedRef.current = false;
    setVisited(false);
  }, [stopHolding]);

  const start = useCallback(() => {
    downAt.current = Date.now();
    visitedRef.current = false;
    setVisited(false);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHolding(true), PEEK_HOLD_MS);
  }, []);

  const keyUp = (event: Pick<PopupKeyEvent, "key">) => {
    if (event.key !== " " || downAt.current === null) return;
    const held = Date.now() - downAt.current;
    stopHolding();
    if (!releaseEndsPeek(held) || visitedRef.current || pinnedRef.current) return;
    if (!windowed) {
      closeRef.current();
      return;
    }
    void clipboardPreviewHasPointer()
      .catch(() => false)
      .then((inside) => {
        if (inside) setVisited((visitedRef.current = true));
        else closeRef.current();
      });
  };

  const lookKey = (event: PopupKeyEvent): boolean => {
    const key = event.key;
    if (key === " " && event.repeat) return true;
    if (key === "Escape" || (key === " " && !pinnedRef.current)) closeRef.current();
    if (key === "Escape" || key === " ") return true;
    if (!windowed) return false;
    if (isPreviewSizeKey(event)) {
      if (!event.repeat) void setClipboardPreviewSize("next").catch(reportError("resize the clipboard preview"));
      return true;
    }
    const command = previewCommandForKey(event);
    if (!command) return false;
    void sendClipboardPreviewCommand(command).catch(reportError("send a preview command"));
    return true;
  };

  useEffect(() => {
    if (!windowed) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    void listenClipboardPreviewReport((report) => {
      if (report.type === "close") closeRef.current();
      else if (report.type === "pinned") pinnedRef.current = report.pinned;
      else if (report.type === "edited") editedRef.current?.(report.id);
      else if (report.type === "pointer" && report.inside && downAt.current !== null) setVisited((visitedRef.current = true));
    }).then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [windowed]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { start, keyUp, lookKey, cancel, holding, visited };
}
