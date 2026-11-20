import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Ellipsis } from "lucide-react";
import "./AgentProviderMenu.css";

export type AgentProviderMenuItem = { key: string; label: string; disabled?: boolean; onSelect: () => void };

export function AgentProviderMenu({ label, items, hint }: { label: string; items: AgentProviderMenuItem[]; hint?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>("[role='menuitem']:not(:disabled)")?.focus());
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || !open) return;
    event.stopPropagation();
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div className="agent-provider-menu" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        className="agent-provider-menu__button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Ellipsis size={16} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {open ? (
        <div className="agent-provider-menu__list" role="menu" aria-label={label}>
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className="agent-provider-menu__item"
              disabled={item.disabled}
              data-menu-item={item.key}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
          {hint ? <div className="agent-provider-menu__hint">{hint}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
