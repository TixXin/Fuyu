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
  confirming?: boolean;
  onSelect: () => void;
};

const MENU_WIDTH = 200;
const EDGE = 8;
const MENU_AREA = ".island__surface";

function menuArea(anchor: HTMLElement) {
  const box = anchor.closest(MENU_AREA)?.getBoundingClientRect();
  const top = Math.max(0, box?.top ?? 0) + EDGE;
  const bottom = Math.min(window.innerHeight, box?.bottom ?? window.innerHeight) - EDGE;
  const left = Math.max(0, box?.left ?? 0) + EDGE;
  const right = Math.max(left + MENU_WIDTH, Math.min(window.innerWidth, box?.right ?? window.innerWidth) - EDGE);
  return { top, bottom: Math.max(top, bottom), left, right };
}

export function RowMenu({ label, items, onOpenChange, buttonClassName, children }: {
  label: string;
  items: RowMenuItem[];
  onOpenChange?: (open: boolean) => void;
  buttonClassName?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ left: number; top: number; maxHeight: number; ink: string; fill: string } | null>(null);
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
    const area = menuArea(buttonRef.current);
    const below = button.bottom + 4;
    const above = button.top - 4 - height;
    const top = below + height <= area.bottom
      ? below
      : above >= area.top
        ? above
        : Math.max(area.top, area.bottom - height);
    const left = Math.max(area.left, Math.min(button.right - MENU_WIDTH, area.right - MENU_WIDTH));
    const style = getComputedStyle(buttonRef.current);
    setPlace({
      left,
      top,
      maxHeight: area.bottom - area.top,
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
        className={children ? buttonClassName : `island-list-icon-button${open ? " island-list-icon-button--open" : ""}`}
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
        {children ?? <MoreHorizontal size={15} strokeWidth={2.2} aria-hidden="true" />}
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="row-menu"
          role="menu"
          aria-label={label}
          style={{ left: place?.left ?? -9999, top: place?.top ?? -9999, maxHeight: place?.maxHeight, width: MENU_WIDTH, "--row-menu-ink": place?.ink, "--row-menu-fill": place?.fill } as CSSProperties}
          onClick={(event) => event.stopPropagation()}
        >
          {items.map((item) => (
            <button
              key={item.key}
              className={`row-menu__item${item.danger ? " row-menu__item--danger" : ""}`}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              data-confirm-control={item.confirming ? "true" : undefined}
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
