import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./PluginDetailModal.css";
import "./PluginMarket.css";

const FOCUSABLE = "button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], summary, [tabindex]:not([tabindex='-1'])";

export function PluginMarketDialog({ label, size, busy = false, onClose, data, children }: {
  label: string;
  size: "wide" | "small";
  busy?: boolean;
  onClose: () => void;
  data: Record<`data-${string}`, string>;
  children: ReactNode;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    setHost(anchorRef.current?.closest<HTMLElement>(".settings-stage") ?? document.body);
  }, []);

  useEffect(() => {
    if (!host) return;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const target = dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]") ?? dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();
    return () => before?.focus();
  }, [host]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (!busy) onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter((el) => el.offsetParent !== null);
    if (items.length === 0) return;
    const [first, last] = [items[0], items[items.length - 1]];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <span ref={anchorRef} hidden />
      {host
        ? createPortal(
            <div className="plugin-dialog__backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
              <div ref={dialogRef} className={`plugin-dialog market-dialog market-dialog--${size}`} role="dialog" aria-modal="true" aria-label={label} onKeyDown={onKeyDown} {...data}>
                {children}
              </div>
            </div>,
            host,
          )
        : null}
    </>
  );
}
