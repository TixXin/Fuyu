import { useState } from "react";
import { useTranslation } from "../../i18n";
import type { ClipboardHistoryItem } from "./api";

export function ClipboardEditor({ item, overlay, onPasteOnce, onSaveAsNew, onCancel }: {
  item: ClipboardHistoryItem;
  overlay: boolean;
  onPasteOnce: (text: string) => void;
  onSaveAsNew: (text: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslation();
  const text = t.clipboard.popup.actions;
  const [value, setValue] = useState(item.text ?? item.preview);

  return (
    <div
      className={`clipboard-editor${overlay ? " clipboard-editor--overlay" : ""}`}
      role="dialog"
      aria-label={text.editTitle}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        } else if (event.key === "Enter" && event.ctrlKey) {
          event.preventDefault();
          if (value) onPasteOnce(value);
        } else if (event.key.toLowerCase() === "s" && event.ctrlKey) {
          event.preventDefault();
          if (value.trim()) onSaveAsNew(value);
        }
      }}
    >
      <span className="clipboard-editor__head">{text.editTitle}<span>{text.editHint}</span></span>
      <textarea
        autoFocus
        value={value}
        spellCheck={false}
        aria-label={text.editTitle}
        onChange={(event) => setValue(event.currentTarget.value)}
        onFocus={(event) => event.currentTarget.setSelectionRange(event.currentTarget.value.length, event.currentTarget.value.length)}
      />
      <div className="clipboard-editor__buttons">
        <button type="button" className="clipboard-editor__primary" disabled={!value} onClick={() => onPasteOnce(value)}>{text.pasteOnce}<kbd>Ctrl ↵</kbd></button>
        <button type="button" disabled={!value.trim()} onClick={() => onSaveAsNew(value)}>{text.saveAsNew}<kbd>Ctrl S</kbd></button>
        <button type="button" onClick={onCancel}>{text.cancel}<kbd>Esc</kbd></button>
      </div>
    </div>
  );
}
