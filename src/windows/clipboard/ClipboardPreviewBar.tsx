import { PencilLine, Pin, PinOff, X } from "lucide-react";
import { useTranslation } from "../../i18n";
import { PRIMARY_KEY } from "../../lib/shortcut/shortcut";
import { PREVIEW_SIZES, type ClipboardPreviewSize, type ClipboardPreviewSizeRequest } from "../../features/clipboard/previewCommands";

export function ClipboardPreviewBar({ hint, size, pinned, editing = false, onEdit, onSize, onTogglePin, onClose }: {
  hint: { key: string; text: string };
  size: ClipboardPreviewSize;
  pinned: boolean;
  editing?: boolean;
  onEdit?: () => void;
  onSize: (size: ClipboardPreviewSizeRequest) => void;
  onTogglePin: () => void;
  onClose: () => void;
}) {
  const t = useTranslation();
  const text = t.clipboard.previewWindow;
  const edit = t.clipboard.popup.actions.editInPreview;
  return (
    <div className="clipboard-preview__bar" role="toolbar" aria-label={text.toolbar} onDoubleClick={(event) => {
      if ((event.target as HTMLElement).closest("button")) return;
      onSize("toggle-full");
    }}>
      <span className="clipboard-preview__hint" title={text.toggleFull}>
        <kbd>{hint.key}</kbd>
        {hint.text}
      </span>
      <div className="clipboard-preview__sizes" role="group" aria-label={`${text.sizes} · ${text.sizeKey}`}>
        {PREVIEW_SIZES.map((choice) => (
          <button key={choice} type="button" tabIndex={-1} aria-pressed={size === choice} className="clipboard-preview__size" onClick={() => onSize(choice)}>
            {text.size[choice]}
          </button>
        ))}
      </div>
      {onEdit && (
        <button type="button" tabIndex={-1} className="clipboard-preview__icon" aria-pressed={editing} aria-label={edit} title={`${edit} · ${PRIMARY_KEY} E`} onClick={onEdit}>
          <PencilLine size={14} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
      <button type="button" tabIndex={-1} className="clipboard-preview__icon" aria-pressed={pinned} aria-label={pinned ? text.unpin : text.pin} title={pinned ? text.unpin : text.pin} onClick={onTogglePin}>
        {pinned ? <PinOff size={14} strokeWidth={2} aria-hidden="true" /> : <Pin size={14} strokeWidth={2} aria-hidden="true" />}
      </button>
      <button type="button" tabIndex={-1} className="clipboard-preview__icon" aria-label={text.close} title={text.close} onClick={onClose}>
        <X size={14} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}
