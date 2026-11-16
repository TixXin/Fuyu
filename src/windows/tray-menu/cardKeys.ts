import type { KeyboardEvent } from "react";

export function cardButtons(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLButtonElement>("button")].filter((button) => button.getClientRects().length > 0);
}

export function focusFirstButton(root: HTMLElement | null) {
  if (root) cardButtons(root)[0]?.focus({ preventScroll: true });
}

function verticalNeighbour(items: HTMLButtonElement[], from: HTMLButtonElement, down: boolean) {
  const origin = from.getBoundingClientRect();
  const cx = origin.left + origin.width / 2;
  const cy = origin.top + origin.height / 2;
  let best: HTMLButtonElement | null = null;
  let bestScore = Infinity;
  for (const item of items) {
    if (item === from) continue;
    const rect = item.getBoundingClientRect();
    const dy = down ? rect.top + rect.height / 2 - cy : cy - (rect.top + rect.height / 2);
    if (dy < Math.min(origin.height, rect.height) / 2) continue;
    const score = dy * 3 + Math.abs(rect.left + rect.width / 2 - cx);
    if (score < bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best ?? (down ? items[0] : items[items.length - 1]);
}

export function handleCardKeys(event: KeyboardEvent<HTMLElement>, onEscape: () => void) {
  if (event.key === "Escape") {
    event.preventDefault();
    onEscape();
    return;
  }
  const items = cardButtons(event.currentTarget);
  const current = event.target instanceof HTMLButtonElement ? items.indexOf(event.target) : -1;
  if (current < 0 || items.length === 0) return;
  let next: HTMLButtonElement | undefined;
  if (event.key === "ArrowRight") next = items[(current + 1) % items.length];
  else if (event.key === "ArrowLeft") next = items[(current - 1 + items.length) % items.length];
  else if (event.key === "Home") next = items[0];
  else if (event.key === "End") next = items[items.length - 1];
  else if (event.key === "ArrowDown" || event.key === "ArrowUp") next = verticalNeighbour(items, items[current], event.key === "ArrowDown");
  if (!next) return;
  event.preventDefault();
  next.focus();
}
