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
  cardClassName?: string;
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
  cardClassName,
}: IslandHoverCardProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const moveFrameRef = useRef(0);
  const pendingMoveRef = useRef(false);
  const cardWidthRef = useRef<number | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const placeRef = useRef<Place | null>(null);
  placeRef.current = place;
  const [left, setLeft] = useState<number | null>(null);
  const pointerRef = useRef<number | null>(null);

  const cancelMove = () => {
    if (moveFrameRef.current !== 0) {
      window.cancelAnimationFrame(moveFrameRef.current);
      moveFrameRef.current = 0;
    }
    pendingMoveRef.current = false;
  };

  const syncLeft = (pointerX: number | null) => {
    const currentPlace = placeRef.current;
    const width = cardWidthRef.current;
    if (!currentPlace || width === null) return;
    const next = cardLeft(currentPlace.center, width, window.innerWidth, pointerX);
    setLeft((prev) => (prev === next ? prev : next));
  };

  const show = () => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    cancelMove();
    cardWidthRef.current = null;
    const rect = (anchor.closest(alignTo) ?? anchor).getBoundingClientRect();
    setLeft(null);
    setPlace({ top: rect.bottom + CARD_OFFSET, center: rect.left + rect.width / 2, root: anchor.closest(portalTo) ?? document.body });
  };
  const hide = () => {
    window.clearTimeout(timerRef.current);
    cancelMove();
    cardWidthRef.current = null;
    pointerRef.current = null;
    setPlace(null);
  };
  const onPointerEnter = (event: PointerEvent) => {
    pointerRef.current = event.clientX;
    schedule();
  };
  const onPointerMove = (event: PointerEvent) => {
    pointerRef.current = event.clientX;
    if (!placeRef.current || cardWidthRef.current === null) return;
    if (moveFrameRef.current === 0) {
      syncLeft(event.clientX);
      moveFrameRef.current = window.requestAnimationFrame(() => {
        moveFrameRef.current = 0;
        if (pendingMoveRef.current) {
          pendingMoveRef.current = false;
          syncLeft(pointerRef.current);
        }
      });
    } else {
      pendingMoveRef.current = true;
    }
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
    cancelMove();
    cardWidthRef.current = null;
    setPlace(null);
  }, [suppressed]);
  useEffect(() => () => {
    window.clearTimeout(timerRef.current);
    cancelMove();
  }, []);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!place || !card) return;
    const width = card.getBoundingClientRect().width;
    cardWidthRef.current = width;
    const next = cardLeft(place.center, width, window.innerWidth, pointerRef.current);
    setLeft((prev) => (prev === next ? prev : next));
  }, [place, lines]);

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
          className={cardClassName ? `island-hover-card ${cardClassName}` : "island-hover-card"}
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
