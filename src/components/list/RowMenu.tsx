import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import "./RowMenu.css";

export type RowMenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  keepOpen?: boolean;
  onSelect: () => void;
};

const MENU_WIDTH = 200;
const EDGE = 8;

export function RowMenu({ label, items, onOpenChange }: { label: string; items: RowMenuItem[]; onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ left: number; top: number; ink: string; fill: string } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const setMenuOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const button = buttonRef.current.getBoundingClientRect();
    const height = menuRef.current?.offsetHeight ?? 0;
    const up = button.bottom + 4 + height > window.innerHeight - EDGE && button.top - 4 - height > EDGE;
    const left = Math.max(EDGE, Math.min(button.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - EDGE));
    const style = getComputedStyle(buttonRef.current);
    setPlace({
      left,
      top: up ? button.top - 4 - height : button.bottom + 4,
      ink: style.getPropertyValue("--island-ink-rgb").trim() || "241, 240, 246",
      fill: style.getPropertyValue("--island-background-color").trim() || "#000",
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      const target = event.target as Node | null;
      if (target && (menuRef.current?.contains(target) || buttonRef.current?.contains(target))) return;
      setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setMenuOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", close, true);
    document.addEventListener("scroll", close, true);
    window.addEventListener("blur", close);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", close, true);
      document.removeEventListener("scroll", close, true);
      window.removeEventListener("blur", close);
      document.removeEventListener("keydown", onKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        className={`island-list-icon-button${open ? " island-list-icon-button--open" : ""}`}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setMenuOpen(!open);
        }}
      >
        <MoreHorizontal size={15} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="row-menu"
          role="menu"
          aria-label={label}
          style={{ left: place?.left ?? -9999, top: place?.top ?? -9999, width: MENU_WIDTH, "--row-menu-ink": place?.ink, "--row-menu-fill": place?.fill } as CSSProperties}
          onClick={(event) => event.stopPropagation()}
        >
          {items.map((item) => (
            <button
              key={item.key}
              className={`row-menu__item${item.danger ? " row-menu__item--danger" : ""}`}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                item.onSelect();
                if (!item.keepOpen) setMenuOpen(false);
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
