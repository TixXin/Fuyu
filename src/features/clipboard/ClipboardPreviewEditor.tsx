import { addClipboardHistoryText, editClipboardHistoryText, pasteClipboardText, reportClipboardPreview, type ClipboardHistoryItem } from "./api";
import { ClipboardEditor } from "./ClipboardEditor";
import type { ClipboardPreviewEditEnd } from "./previewCommands";
import { usePreviewEditSession } from "./usePreviewEditSession";

const drafts = new Map<string, string>();

const failed = (action: string) => (error: unknown) => console.error(`Failed to ${action}`, error);

export function ClipboardPreviewEditor({ item, onDone }: { item: ClipboardHistoryItem; onDone: () => void }) {
  const finish = usePreviewEditSession(item.id, onDone);

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
