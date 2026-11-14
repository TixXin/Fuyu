import { Pin, PinOff, X } from "lucide-react";
import { useTranslation } from "../../i18n";

type ClipboardTitleBarProps = {
  pinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
};

export function ClipboardTitleBar({ pinned, onTogglePin, onClose }: ClipboardTitleBarProps) {
  const text = useTranslation().clipboard.window;
  const pinLabel = pinned ? text.unpin : text.pin;
  return (
    <header className="clipboard-titlebar" data-tauri-drag-region>
      <span className="clipboard-titlebar__title" data-tauri-drag-region>{text.title}</span>
      <button
        type="button"
        className={`clipboard-titlebar__button${pinned ? " clipboard-titlebar__button--on" : ""}`}
        aria-label={pinLabel}
        aria-pressed={pinned}
        title={pinLabel}
        onClick={onTogglePin}
      >
        {pinned ? <PinOff size={14} /> : <Pin size={14} />}
      </button>
      <button type="button" className="clipboard-titlebar__button" aria-label={text.close} title={text.close} onClick={onClose}>
        <X size={14} />
      </button>
    </header>
  );
}
