import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Ellipsis } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { IslandPage } from "./types";
import type { SpotlightProps } from "./usePluginSpotlight";
import "./NotchHeaderMore.css";

export type NotchHeaderMoreItem = {
  id: IslandPage;
  label: string;
  shortcut: string | null;
  icon: ReactNode;
  active: boolean;
  spotlight?: SpotlightProps;
};

type MenuPlace = {
  top: number;
  left: number | null;
  anchorLeft: number;
  minLeft: number;
  maxRight: number;
  root: Element;
};

const MENU_OFFSET = 6;
const EDGE_INSET = 8;

export function NotchHeaderMore({
  items,
  page,
  buttonRef,
  onSelect,
}: {
  items: readonly NotchHeaderMoreItem[];
  page: IslandPage;
  buttonRef?: (element: HTMLButtonElement | null) => void;
  onSelect: (page: IslandPage) => void;
}) {
  const copy = useTranslation().island;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [place, setPlace] = useState<MenuPlace | null>(null);
  const open = place !== null;
  const hasActive = items.some((item) => item.active);
  const spotlight = items.find((item) => item.spotlight)?.spotlight;

  const setTrigger = useCallback((element: HTMLButtonElement | null) => {
    triggerRef.current = element;
    buttonRef?.(element);
  }, [buttonRef]);

  const hide = useCallback(() => setPlace(null), []);

  const show = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const anchor = trigger.getBoundingClientRect();
    const island = (trigger.closest(".island") ?? trigger).getBoundingClientRect();
    setPlace({
      top: anchor.bottom + MENU_OFFSET,
      left: null,
      anchorLeft: anchor.left,
      minLeft: island.left + EDGE_INSET,
      maxRight: island.right - EDGE_INSET,
      root: trigger.closest(".stage") ?? document.body,
    });
  }, []);

  useEffect(() => {
    setPlace(null);
  }, [page, items.length]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!place || !menu || place.left !== null) return;
    const width = menu.getBoundingClientRect().width;
    const maxLeft = Math.max(place.minLeft, place.maxRight - width);
    const left = Math.max(place.minLeft, Math.min(place.anchorLeft, maxLeft));
    setPlace({ ...place, left });
  }, [place]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (triggerRef.current?.contains(target) || menuRef.current?.contains(target))) return;
      hide();
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      hide();
      triggerRef.current?.focus();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, hide]);

  const onTriggerKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      hide();
    } else if (event.key === "ArrowDown" && open) {
      event.preventDefault();
      menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
  };

  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      hide();
      triggerRef.current?.focus();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(at + (event.key === "ArrowDown" ? 1 : buttons.length - 1)) % Math.max(buttons.length, 1)]?.focus();
  };

  return (
    <>
      <button
        ref={setTrigger}
        className={`island__header-more${hasActive ? " island__header-more--active" : ""}`}
        type="button"
        aria-label={copy.headerMore(items.length)}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          if (open) hide();
          else show();
        }}
        onKeyDown={onTriggerKey}
        {...spotlight}
      >
        <Ellipsis size={13} strokeWidth={2} absoluteStrokeWidth aria-hidden="true" />
        <span>+{items.length}</span>
      </button>
      {place && createPortal(
        <div
          ref={menuRef}
          className="island-header-more-menu"
          role="menu"
          aria-label={copy.headerMoreMenu}
          style={{ top: place.top, left: place.left ?? place.anchorLeft, visibility: place.left === null ? "hidden" : undefined }}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={onMenuKey}
        >
          {items.map((item) => (
            <button
              key={item.id}
              className={`island-header-more-menu__item${item.active ? " island-header-more-menu__item--active" : ""}`}
              type="button"
              role="menuitem"
              data-page={item.id}
              aria-current={item.active ? "page" : undefined}
              onClick={(event) => {
                event.stopPropagation();
                hide();
                onSelect(item.id);
              }}
            >
              <span className="island-header-more-menu__icon" aria-hidden="true">{item.icon}</span>
              <span className="island-header-more-menu__label">{item.label}</span>
              {item.shortcut && <span className="island-header-more-menu__shortcut">{item.shortcut}</span>}
            </button>
          ))}
        </div>,
        place.root,
      )}
    </>
  );
}
