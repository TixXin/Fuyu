import { holdFitWidth } from "./collapsedFitStore.ts";

const OPEN_BUTTON = "island__open-button";
const CENTER_SLOT = ".island__center-slot";
const FIT_ITEM = "[data-fit-item]";
const BAR_UNIT = "data-bar-unit";

export type CollapsedContentParts = {
  padStart: number;
  padEnd: number;
  left: number;
  right: number;
  open: number;
  center: number;
};

export function contentNeed({ padStart, padEnd, left, right, open, center }: CollapsedContentParts) {
  if (center > 0) return Math.ceil(center + 2 * Math.max(padStart + left, padEnd + right));
  return Math.ceil(padStart + padEnd + left + right + open);
}

function px(value: string) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : 0;
}

function naturalWidth(element: HTMLElement) {
  let clipped = 0;
  for (const outer of element.matches(FIT_ITEM) ? [element] : element.querySelectorAll<HTMLElement>(FIT_ITEM)) {
    const inner = outer.firstElementChild;
    if (inner instanceof HTMLElement) clipped += Math.max(0, inner.offsetWidth + 1 - outer.clientWidth);
  }
  return element.offsetWidth + clipped;
}

function inFlow(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement) || element.getClientRects().length === 0) return false;
  const position = getComputedStyle(element).position;
  return position !== "absolute" && position !== "fixed";
}

function flowChildren(parent: Element): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const child of parent.children) {
    if (!(child instanceof HTMLElement)) continue;
    if (child.hasAttribute(BAR_UNIT)) {
      out.push(...flowChildren(child));
      continue;
    }
    if (inFlow(child)) out.push(child);
  }
  return out;
}

export function measureCollapsedContent(bar: HTMLElement) {
  const children = flowChildren(bar);
  const openIndex = children.findIndex((child) => child.classList.contains(OPEN_BUTTON));
  if (openIndex < 0) return 0;
  const style = getComputedStyle(bar);
  const gap = px(style.columnGap);
  const sum = (elements: HTMLElement[]) => elements.reduce((total, element) => total + naturalWidth(element) + gap, 0);
  const open = children[openIndex];
  const openStyle = getComputedStyle(open);
  const center = open.querySelector<HTMLElement>(CENTER_SLOT);
  return contentNeed({
    padStart: px(style.paddingLeft),
    padEnd: px(style.paddingRight),
    left: sum(children.slice(0, openIndex)),
    right: sum(children.slice(openIndex + 1)),
    open: px(openStyle.paddingLeft) + px(openStyle.paddingRight),
    center: center && center.getClientRects().length > 0 ? center.scrollWidth : 0,
  });
}

export function createCollapsedContent() {
  let held = 0;
  const listeners = new Set<() => void>();
  return {
    report(measured: number) {
      const next = measured > 0 ? holdFitWidth(held > 0 ? held : undefined, measured) : 0;
      if (next === held) return;
      held = next;
      for (const listener of listeners) listener();
    },
    total: () => held,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const collapsedContent = createCollapsedContent();
