import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import "./PluginDialog.css";

const FOCUSABLE = "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex='-1'])";

export function PluginDialog({ label, closeLabel, tone, header, children, onClose }: {
  label: string;
  closeLabel: string;
  tone?: string;
  header: ReactNode;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    close.current?.focus();
    return () => before?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const items = [...(dialog.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter((item) => item.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="plugin-dialog__backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={dialog} className={tone ? `plugin-dialog plugin-dialog--${tone}` : "plugin-dialog"} role="dialog" aria-modal="true" aria-label={label} onKeyDown={onKeyDown}>
        <header className="plugin-dialog__header">
          {header}
          <button ref={close} className="plugin-dialog__close" type="button" aria-label={closeLabel} title={closeLabel} onClick={onClose}>
            <X size={16} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </header>
        <div className="plugin-dialog__body">{children}</div>
      </div>
    </div>,
    document.querySelector(".settings-stage") ?? document.body,
  );
}
