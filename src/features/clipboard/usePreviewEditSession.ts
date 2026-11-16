import { useEffect, useRef } from "react";
import { listenClipboardPreviewBlur, setClipboardPreviewEditing } from "./api";
import type { ClipboardPreviewEditEnd } from "./previewCommands";

const failed = (action: string) => (error: unknown) => console.error(`Failed to ${action}`, error);

export function usePreviewEditSession(id: string, onDone: () => void) {
  const open = useRef(true);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const finish = (then: ClipboardPreviewEditEnd) => {
    if (!open.current) return Promise.resolve();
    open.current = false;
    doneRef.current();
    return setClipboardPreviewEditing(false, then).catch(failed("give the keyboard back"));
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    open.current = true;
    void setClipboardPreviewEditing(true).catch((error: unknown) => {
      failed("take the keyboard for editing")(error);
      void finishRef.current("refocus");
    });
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    void listenClipboardPreviewBlur(() => void finishRef.current("blur")).then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return finish;
}
