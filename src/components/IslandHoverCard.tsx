import { useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CARD_OFFSET, cardLeft } from "./hoverCardPlacement";
import "./IslandHoverCard.css";

export type HoverCardLine = { text: string; color?: string; muted?: boolean };

type IslandHoverCardProps = {
  lines: readonly HoverCardLine[];
  children: ReactNode;
  delayMs?: number;
  suppressed?: boolean;
  alignTo?: string;
  portalTo?: string;
  anchorClassName?: string;
};

type Place = { top: number; center: number; root: Element };

export function IslandHoverCard({
  lines,
  children,
  delayMs = 200,
  suppressed = false,
  alignTo = ".island",
  portalTo = ".stage",
  anchorClassName,
}: IslandHoverCardProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const [place, setPlace] = useState<Place | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const pointerRef = useRef<number | null>(null);
  const [pointerX, setPointerX] = useState<number | null>(null);

  const show = () => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = (anchor.closest(alignTo) ?? anchor).getBoundingClientRect();
    setLeft(null);
    setPointerX(pointerRef.current);
    setPlace({ top: rect.bottom + CARD_OFFSET, center: rect.left + rect.width / 2, root: anchor.closest(portalTo) ?? document.body });
  };
  const hide = () => {
    window.clearTimeout(timerRef.current);
    pointerRef.current = null;
    setPlace(null);
  };
  const onPointerEnter = (event: PointerEvent) => {
    pointerRef.current = event.clientX;
    schedule();
  };
  const onPointerMove = (event: PointerEvent) => {
    pointerRef.current = event.clientX;
    if (place) setPointerX(event.clientX);
  };
  const schedule = () => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(show, delayMs);
  };
  const onFocus = (event: FocusEvent) => {
    if (event.target instanceof Element && event.target.matches(":focus-visible")) show();
  };

  useEffect(() => {
    if (!suppressed) return;
    window.clearTimeout(timerRef.current);
    setPlace(null);
  }, [suppressed]);
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!place || !card) return;
    setLeft(cardLeft(place.center, card.getBoundingClientRect().width, window.innerWidth, pointerX));
  }, [place, lines, pointerX]);

  const open = place !== null && !suppressed && lines.length > 0;
  return (
    <span
      ref={anchorRef}
      className={anchorClassName ? `island-hover-card__anchor ${anchorClassName}` : "island-hover-card__anchor"}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={onFocus}
      onBlur={hide}
    >
      {children}
      {open && createPortal(
        <div
          ref={cardRef}
          className="island-hover-card"
          role="tooltip"
          style={{ top: place.top, left: left ?? place.center, visibility: left === null ? "hidden" : undefined }}
        >
          {lines.map((line, index) => (
            <div key={index} className={`island-hover-card__line${line.muted ? " island-hover-card__line--muted" : ""}`}>
              {line.color && <span className="island-hover-card__dot" style={{ background: line.color }} aria-hidden="true" />}
              <span>{line.text}</span>
            </div>
          ))}
        </div>,
        place.root,
      )}
    </span>
  );
}
