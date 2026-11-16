import { useEffect, useRef } from "react";
import { listenClipboardPreviewCommand } from "./api";
import type { ClipboardPreviewCommand } from "./previewCommands";

export function useClipboardPreviewCommand(handler: (command: ClipboardPreviewCommand) => void, enabled = true) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    void listenClipboardPreviewCommand((command) => handlerRef.current(command)).then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [enabled]);
}
