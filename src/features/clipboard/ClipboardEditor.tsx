import { useState, type KeyboardEvent } from "react";
import { useTranslation } from "../../i18n";
import type { ClipboardHistoryItem } from "./api";
import { isPrimaryKey, PRIMARY_KEY } from "../../lib/shortcut/shortcut";

export type ClipboardEditorActions = {
  onPasteOnce: (text: string) => void;
  onSaveInPlace: (text: string) => void;
  onSaveAsNew: (text: string) => void;
  onCancel: () => void;
  onChange?: (text: string) => void;
};

export function ClipboardEditor({ item, overlay, initial, className, onPasteOnce, onSaveInPlace, onSaveAsNew, onCancel, onChange }: ClipboardEditorActions & {
  item: ClipboardHistoryItem;
  overlay: boolean;
  initial?: string;
  className?: string;
}) {
  const t = useTranslation();
  const text = t.clipboard.popup.actions;
  const [value, setValue] = useState(initial ?? item.text ?? item.preview);
  const savable = value.trim() !== "";

  const onKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.nativeEvent.isComposing) return;
    const primary = isPrimaryKey(event) && !event.altKey;
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    } else if (event.key === "Enter" && primary) {
      event.preventDefault();
      if (value) onPasteOnce(value);
    } else if (event.key.toLowerCase() === "s" && primary) {
      event.preventDefault();
      if (!savable) return;
      if (event.shiftKey) onSaveAsNew(value);
      else onSaveInPlace(value);
    }
  };

  return (
    <div className={["clipboard-editor", overlay ? "clipboard-editor--overlay" : "", className ?? ""].filter(Boolean).join(" ")} role="dialog" aria-label={text.editTitle} onKeyDown={onKeyDown}>
      <span className="clipboard-editor__head">{text.editTitle}<span>{text.editHint}</span></span>
      <textarea
        autoFocus
        value={value}
        spellCheck={false}
        aria-label={text.editTitle}
        onChange={(event) => {
          setValue(event.currentTarget.value);
          onChange?.(event.currentTarget.value);
        }}
        onFocus={(event) => event.currentTarget.setSelectionRange(event.currentTarget.value.length, event.currentTarget.value.length)}
      />
      <div className="clipboard-editor__buttons">
        <button type="button" className="clipboard-editor__primary" disabled={!savable} onClick={() => onSaveInPlace(value)}>{text.saveInPlace}<kbd>{PRIMARY_KEY} S</kbd></button>
        <button type="button" disabled={!savable} onClick={() => onSaveAsNew(value)}>{text.saveAsNew}<kbd>{PRIMARY_KEY} ⇧ S</kbd></button>
        <button type="button" disabled={!value} onClick={() => onPasteOnce(value)}>{text.pasteOnce}<kbd>{PRIMARY_KEY} ↵</kbd></button>
        <button type="button" onClick={onCancel}>{text.cancel}<kbd>Esc</kbd></button>
      </div>
    </div>
  );
}
