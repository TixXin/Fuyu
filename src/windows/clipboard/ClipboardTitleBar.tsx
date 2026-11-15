import { Maximize2, Minimize2, Pin, PinOff, X } from "lucide-react";
import { useTranslation } from "../../i18n";

type ClipboardTitleBarProps = {
  pinned: boolean;
  expanded: boolean;
  onTogglePin: () => void;
  onToggleExpanded: () => void;
  onClose: () => void;
};

export function ClipboardTitleBar({ pinned, expanded, onTogglePin, onToggleExpanded, onClose }: ClipboardTitleBarProps) {
  const clipboard = useTranslation().clipboard;
  const text = clipboard.window;
  const pinLabel = pinned ? text.unpin : text.pin;
  const expandLabel = expanded ? clipboard.manage.collapse : clipboard.manage.expand;
  return (
    <header className="clipboard-titlebar" data-tauri-drag-region>
      <span className="clipboard-titlebar__title" data-tauri-drag-region>{expanded ? clipboard.manage.label : text.title}</span>
      <button
        type="button"
        className={`clipboard-titlebar__button${expanded ? " clipboard-titlebar__button--on" : ""}`}
        aria-label={expandLabel}
        aria-pressed={expanded}
        title={expandLabel}
        onClick={onToggleExpanded}
      >
        {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
      </button>
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
