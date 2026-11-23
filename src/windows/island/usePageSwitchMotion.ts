import { useEffect, useLayoutEffect, useRef } from "react";
import { nextCarouselTurn, resolvePageSwitch, pageSwitchSpeed, type PageSwitchMotion, type SwitchDirection, type SwitchPoint } from "../../lib/theme/pageSwitch";
import { playPageSwitch, type PageSwitchHandle } from "../../lib/theme/playPageSwitch";
import { pageShortcutOrder, type IslandFeatures } from "./features";
import { PAGE_ARROW_PULSE_EVENT } from "./pageArrows";
import type { IslandMode, IslandPage } from "./types";

const INTENT_MS = 600;

type Intent = { at: number; direction: SwitchDirection; point: SwitchPoint | null };

function sideDirection(side: unknown): SwitchDirection {
  return side === "next" ? 1 : side === "previous" ? -1 : 0;
}

function pageDirection(features: IslandFeatures, from: IslandPage, to: IslandPage): SwitchDirection {
  const order = pageShortcutOrder(features);
  const before = order.indexOf(from);
  const after = order.indexOf(to);
  if (before < 0 || after < 0 || before === after) return 0;
  return after > before ? 1 : -1;
}

export function usePageSwitchMotion<T extends HTMLElement>(page: IslandPage, mode: IslandMode, motion: PageSwitchMotion, features: IslandFeatures) {
  const contentRef = useRef<T>(null);
  const previous = useRef({ page, mode });
  const intent = useRef<Intent | null>(null);
  const running = useRef<PageSwitchHandle | null>(null);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const arrow = target?.closest(".island-page-arrow--previous, .island-page-arrow--next");
      intent.current = {
        at: performance.now(),
        direction: arrow ? sideDirection(arrow.classList.contains("island-page-arrow--next") ? "next" : "previous") : 0,
        point: { x: event.clientX, y: event.clientY },
      };
    };
    const onPulse = (event: Event) => {
      intent.current = { at: performance.now(), direction: sideDirection((event as CustomEvent<unknown>).detail), point: null };
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener(PAGE_ARROW_PULSE_EVENT, onPulse);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener(PAGE_ARROW_PULSE_EVENT, onPulse);
      running.current?.finish();
    };
  }, []);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = { page, mode };
    const stage = contentRef.current;
    if (before.page === page || before.mode !== "expanded" || mode !== "expanded" || !stage) return;
    running.current?.finish();
    running.current = null;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const effect = resolvePageSwitch(motion.effect, motion.effect === "carousel" ? nextCarouselTurn() : 0, reduced);
    if (effect === "none") return;
    const fresh = intent.current && performance.now() - intent.current.at < INTENT_MS ? intent.current : null;
    intent.current = null;
    const direction = motion.directional ? (fresh?.direction || pageDirection(features, before.page, page)) : 0;
    const box = stage.getBoundingClientRect();
    const origin = motion.directional && fresh?.point ? { x: fresh.point.x - box.left, y: fresh.point.y - box.top } : null;
    const targets = [...stage.children].filter((child): child is HTMLElement => child instanceof HTMLElement && !child.classList.contains("island-page-arrow") && !child.dataset.pageSwitchOverlay);
    running.current = playPageSwitch({ stage, targets, effect, direction, axis: "x", origin, speed: pageSwitchSpeed(motion.speed) });
  }, [features, mode, motion, page]);

  return contentRef;
}
