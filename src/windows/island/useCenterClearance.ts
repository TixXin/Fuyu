import { useLayoutEffect, type RefObject } from "react";

const OPEN_BUTTON = "island__open-button";
const CENTER_SLOT = "island__center-slot";
const CLEARANCE = 4;
const CROWDED = "data-crowded";

export type Span = { left: number; right: number };

export function centerCrowded(center: Span, items: readonly Span[], clearance = CLEARANCE) {
  if (center.right <= center.left) return false;
  return items.some((item) => item.right > item.left && item.right + clearance > center.left && item.left - clearance < center.right);
}

function sideBoxes(parent: Element): Element[] {
  const boxes: Element[] = [];
  for (const child of parent.children) {
    if (child.classList.contains(OPEN_BUTTON)) continue;
    const style = getComputedStyle(child);
    if (style.display === "contents") boxes.push(...sideBoxes(child));
    else if (style.position !== "absolute" && style.position !== "fixed" && child.getClientRects().length > 0) boxes.push(child);
  }
  return boxes;
}

function centerSlot(bar: HTMLElement) {
  return bar.querySelector<HTMLElement>(`:scope > .${OPEN_BUTTON} > .${CENTER_SLOT}`);
}

export function measureCenterCrowded(bar: HTMLElement) {
  const slot = centerSlot(bar);
  if (!slot || slot.getClientRects().length === 0) return false;
  return centerCrowded(slot.getBoundingClientRect(), sideBoxes(bar).map((box) => box.getBoundingClientRect()));
}

export function useCenterClearance(barRef: RefObject<HTMLElement | null>, enabled: boolean) {
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!enabled || !bar) return;
    const measure = () => centerSlot(bar)?.toggleAttribute(CROWDED, measureCenterCrowded(bar));
    measure();
    if (typeof ResizeObserver === "undefined" || typeof MutationObserver === "undefined") return () => centerSlot(bar)?.removeAttribute(CROWDED);
    const sizes = new ResizeObserver(measure);
    const watch = () => {
      sizes.disconnect();
      sizes.observe(bar);
      for (const box of bar.querySelectorAll(`:scope > *, :scope > * > *, .${CENTER_SLOT}`)) sizes.observe(box);
    };
    watch();
    const tree = new MutationObserver(() => {
      watch();
      measure();
    });
    tree.observe(bar, { childList: true, subtree: true });
    return () => {
      tree.disconnect();
      sizes.disconnect();
      centerSlot(bar)?.removeAttribute(CROWDED);
    };
  }, [barRef, enabled]);
}
