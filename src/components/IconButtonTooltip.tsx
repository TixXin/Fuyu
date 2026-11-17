import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CARD_OFFSET, cardLeft } from "./hoverCardPlacement";
import "./IslandHoverCard.css";

const DELAY_MS = 1500;
export const HIDE_TOOLTIP_EVENT = "fuyu-hide-tooltip";
const TARGETS = "[title], [data-tooltip], button, [role='button'], [role='switch']";

type Tip = { element: HTMLElement; text: string; pointerX: number | null };

export function tooltipTarget(target: EventTarget | null): { element: HTMLElement; text: string } | null {
  if (!(target instanceof Element)) return null;
  const element = target.closest<HTMLElement>(TARGETS);
  if (!element || element.closest(".island-hover-card__anchor")) return null;
  const title = element.getAttribute("title");
  if (title !== null) {
    element.removeAttribute("title");
    if (title.trim()) element.dataset.tooltip = title;
  }
  const text = element.dataset.tooltip
    ?? (/^[\d+]*$/.test(element.textContent?.trim() ?? "") ? element.getAttribute("aria-label") : null);
  return text ? { element, text } : null;
}

function targetVisible(element: HTMLElement): boolean {
  if (!element.isConnected) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  if (getComputedStyle(element).pointerEvents === "none") return false;
  if (typeof element.checkVisibility === "function") return element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  for (let node: Element | null = element; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.opacity === "0" || style.visibility === "hidden" || style.display === "none") return false;
  }
  return true;
}

export function IconButtonTooltip({ scope = ".island", delay = DELAY_MS }: { scope?: string; delay?: number }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const pressedRef = useRef<HTMLElement | null>(null);
  const currentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const inScope = (target: EventTarget | null) => target instanceof Element && target.closest(scope) !== null;
    const hide = () => { window.clearTimeout(timerRef.current); currentRef.current = null; setTip(null); };
    const onOver = (event: PointerEvent) => {
      const found = inScope(event.target) ? tooltipTarget(event.target) : null;
      if (!found) { hide(); return; }
      if (found.element === pressedRef.current || found.element === currentRef.current) return;
      hide();
      currentRef.current = found.element;
      timerRef.current = window.setTimeout(() => {
        if (targetVisible(found.element)) setTip({ ...found, pointerX: event.clientX });
        else currentRef.current = null;
      }, delay);
    };
    const onOut = (event: PointerEvent) => {
      const from = event.target instanceof Element ? event.target.closest(TARGETS) : null;
      if (from && !(event.relatedTarget instanceof Node && from.contains(event.relatedTarget))) {
        if (pressedRef.current === from) pressedRef.current = null;
        hide();
      }
    };
    const onDown = (event: PointerEvent) => {
      pressedRef.current = tooltipTarget(event.target)?.element ?? null;
      hide();
    };
    const onFocus = (event: FocusEvent) => {
      if (!(event.target instanceof Element) || !event.target.matches(":focus-visible") || !inScope(event.target)) return;
      const found = tooltipTarget(event.target);
      if (found) { window.clearTimeout(timerRef.current); currentRef.current = found.element; setTip({ ...found, pointerX: null }); }
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") hide(); };
    const onVisibility = () => { if (document.visibilityState === "hidden") hide(); };
    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", hide);
    document.addEventListener("scroll", hide, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("blur", hide);
    window.addEventListener(HIDE_TOOLTIP_EVENT, hide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      hide();
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("scroll", hide, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", hide);
      window.removeEventListener(HIDE_TOOLTIP_EVENT, hide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [scope, delay]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!tip || !card) { setPlace(null); return; }
    const measure = () => {
      if (!targetVisible(tip.element)) { currentRef.current = null; setTip(null); return; }
      const rect = tip.element.getBoundingClientRect();
      const size = card.getBoundingClientRect();
      const bottom = tip.element.closest(scope)?.getBoundingClientRect().bottom ?? window.innerHeight;
      const below = rect.bottom + CARD_OFFSET;
      const above = rect.top - CARD_OFFSET - size.height;
      const left = cardLeft(rect.left + rect.width / 2, size.width, window.innerWidth, tip.pointerX);
      const top = below + size.height > bottom && above >= 0 ? above : below;
      setPlace((previous) => previous?.left === left && previous.top === top ? previous : { left, top });
    };
    measure();
    const timer = window.setInterval(measure, 200);
    return () => window.clearInterval(timer);
  }, [tip, scope]);

  if (!tip) return null;
  return createPortal(
    <div
      ref={cardRef}
      className="island-hover-card"
      role="tooltip"
      style={{ top: place?.top ?? 0, left: place?.left ?? 0, visibility: place ? undefined : "hidden" }}
    >
      <div className="island-hover-card__line"><span>{tip.text}</span></div>
    </div>,
    tip.element.closest(".stage, .island-light") ?? document.body,
  );
}
