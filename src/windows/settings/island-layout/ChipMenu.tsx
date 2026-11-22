import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "../../../i18n";
import type { LaneId } from "./laneMoves";

const EDGE_PX = 8;
const PLACES: readonly LaneId[] = ["left", "right", "shelf"];

export function ChipMenu({ lane, x, y, styled, onPlace, onStyle, onOff, onClose }: {
  lane: LaneId;
  x: number;
  y: number;
  styled: boolean;
  onPlace: (lane: LaneId) => void;
  onStyle: () => void;
  onOff: () => void;
  onClose: (refocus: boolean) => void;
}) {
  const text = useTranslation().settings.collapsedItems.lanes;
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const menu = root.current;
    if (!menu) return;
    menu.style.left = `${Math.max(EDGE_PX, Math.min(x, window.innerWidth - menu.offsetWidth - EDGE_PX))}px`;
    menu.style.top = `${Math.max(EDGE_PX, Math.min(y, window.innerHeight - menu.offsetHeight - EDGE_PX))}px`;
    menu.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
  }, [x, y]);

  useEffect(() => {
    const away = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onClose(false);
    };
    const blur = () => onClose(false);
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("blur", blur);
    };
  }, [onClose]);

  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      onClose(true);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const buttons = [...(root.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    buttons[(at + step + buttons.length) % buttons.length]?.focus();
  };

  const choose = (action: () => void) => () => {
    onClose(true);
    action();
  };

  return (
    <div className="lane-menu" role="menu" ref={root} onKeyDown={keys}>
      {PLACES.map((place) => (
        <button key={place} type="button" role="menuitem" data-place={place} disabled={lane === place} onClick={choose(() => onPlace(place))}>
          <span className="lane-menu__check" aria-hidden="true">{lane === place ? <Check size={13} strokeWidth={2.4} /> : null}</span>
          {text.placeIn(text.name[place])}
        </button>
      ))}
      {styled ? <hr /> : null}
      {styled ? (
        <button type="button" role="menuitem" data-place="style" onClick={choose(onStyle)}>
          <span className="lane-menu__check" aria-hidden="true" />
          {text.style}
        </button>
      ) : null}
      <hr />
      <button type="button" role="menuitem" data-place="off" onClick={choose(onOff)}>
        <span className="lane-menu__check" aria-hidden="true" />
        {text.takeOff}
        <kbd>Del</kbd>
      </button>
    </div>
  );
}
