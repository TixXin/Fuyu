import { useEffect, useRef } from "react";
import { cycleShortcutPage, type IslandFeatures } from "./features";
import { PAGE_ARROW_PULSE_EVENT, pageArrowAction, pageArrowTargetAllows, type PageArrowSide } from "./pageArrows";
import type { IslandMode, IslandPage } from "./types";

type PageArrowKeys = {
  enabled: boolean;
  mode: IslandMode;
  blocked: boolean;
  features: IslandFeatures;
  page: IslandPage;
  homePage: IslandPage;
  onPageChange: (page: IslandPage) => void;
  onOpenPage: (page: IslandPage) => void;
  onCollapse: () => void;
};

function scrolledPanelArea(): HTMLElement | null {
  const root = document.querySelector<HTMLElement>("#island-panel .island__content");
  if (!root) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node instanceof HTMLElement && node.scrollTop > 1 && node.scrollHeight > node.clientHeight) return node;
  }
  return null;
}

export function pulsePageArrow(side: PageArrowSide) {
  window.dispatchEvent(new CustomEvent<PageArrowSide>(PAGE_ARROW_PULSE_EVENT, { detail: side }));
}

export function usePageArrowKeys(keys: PageArrowKeys) {
  const latest = useRef(keys);
  useEffect(() => {
    latest.current = keys;
  });

  useEffect(() => {
    if (!keys.enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const current = latest.current;
      const action = pageArrowAction(event, current.mode === "expanded");
      if (!action) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!pageArrowTargetAllows(action, event.key, target)) return;
      if (action === "open") {
        event.preventDefault();
        current.onOpenPage(current.homePage);
        return;
      }
      if (current.blocked) return;
      event.preventDefault();
      if (action === "collapse") {
        const scrolled = scrolledPanelArea();
        if (!scrolled) current.onCollapse();
        else scrolled.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        return;
      }
      const next = cycleShortcutPage(current.features, current.page, action === "previous" ? -1 : 1);
      if (!next) return;
      current.onPageChange(next);
      pulsePageArrow(action);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [keys.enabled]);
}
