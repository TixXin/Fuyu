import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, Ellipsis } from "lucide-react";

export interface PluginMenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  checked?: boolean;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
}

export function PluginMenu({ label, items, outlined = false }: { label: string; items: readonly PluginMenuItem[]; outlined?: boolean }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>("[role='menuitem']:not(:disabled), [role='menuitemcheckbox']:not(:disabled)")?.focus());
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const all = [...(rootRef.current?.querySelectorAll<HTMLButtonElement>("[role^='menuitem']:not(:disabled)") ?? [])];
    if (all.length === 0) return;
    event.preventDefault();
    const index = all.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? (index + 1) % all.length : (index - 1 + all.length) % all.length;
    all[next].focus();
  };

  return (
    <div className="plugin-menu" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        className={`plugin-icon-btn${outlined ? " plugin-icon-btn--outlined" : ""}`}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Ellipsis size={16} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {open ? (
        <div className="plugin-menu__list" role="menu" aria-label={label}>
          {items.map((item) => (
            <div key={item.key} className="plugin-menu__group">
              {item.separatorBefore ? <hr className="plugin-menu__sep" /> : null}
              <button
                className={`plugin-menu__item${item.danger ? " plugin-menu__item--danger" : ""}`}
                type="button"
                role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
                aria-checked={item.checked}
                disabled={item.disabled}
                data-menu-item={item.key}
                onClick={() => {
                  if (item.checked === undefined) setOpen(false);
                  item.onSelect();
                }}
              >
                <span className="plugin-menu__icon" aria-hidden="true">{item.icon}</span>
                <span className="plugin-menu__label">{item.label}</span>
                {item.checked !== undefined ? <span className="plugin-menu__check" aria-hidden="true">{item.checked ? <Check size={14} strokeWidth={2.4} /> : null}</span> : null}
              </button>
              {item.hint ? <div className="plugin-menu__hint">{item.hint}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
