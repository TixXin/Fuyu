import { useEffect, useRef } from "react";
import {
  addClipboardHistoryText, editClipboardHistoryText, listenClipboardPreviewBlur, pasteClipboardText, reportClipboardPreview, setClipboardPreviewEditing,
  type ClipboardHistoryItem,
} from "./api";
import { ClipboardEditor } from "./ClipboardEditor";
import type { ClipboardPreviewEditEnd } from "./previewCommands";

const drafts = new Map<string, string>();

const failed = (action: string) => (error: unknown) => console.error(`Failed to ${action}`, error);

export function ClipboardPreviewEditor({ item, onDone }: { item: ClipboardHistoryItem; onDone: () => void }) {
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
  }, [item.id]);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    void listenClipboardPreviewBlur(() => void finishRef.current("blur")).then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  const settle = (then: ClipboardPreviewEditEnd) => {
    drafts.delete(item.id);
    return finish(then);
  };

  return (
    <ClipboardEditor
      item={item}
      overlay={false}
      className="clipboard-preview__editor"
      initial={drafts.get(item.id)}
      onChange={(value) => drafts.set(item.id, value)}
      onCancel={() => void settle("refocus")}
      onPasteOnce={(value) => void settle("leave").then(() => pasteClipboardText(value)).catch(failed("paste from the editor"))}
      onSaveAsNew={(value) => {
        void addClipboardHistoryText(value).catch(failed("save the edit as a new entry"));
        void settle("refocus");
      }}
      onSaveInPlace={(value) => {
        void editClipboardHistoryText(item.id, value)
          .then(() => reportClipboardPreview({ type: "edited", id: item.id }))
          .catch(failed("update the clipboard entry"));
        void settle("refocus");
      }}
    />
  );
}
