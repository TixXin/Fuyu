import type { BarUsageWings } from "./barUsage.ts";

const UNIT = "data-bar-items";
const PARTS = `[${UNIT}], .island__more-chip, .island__center-slot, .island__summary`;

function seen(element: Element): boolean {
  const box = element.getBoundingClientRect();
  if (box.width > 0.5 && box.height > 0.5) return true;
  return [...element.children].some(seen);
}

function readWing(wing: Element | null): string[] {
  if (!wing) return [];
  const ids: string[] = [];
  for (const part of wing.querySelectorAll(PARTS)) {
    if (!seen(part)) continue;
    if (part.hasAttribute(UNIT)) ids.push(...(part.getAttribute(UNIT) ?? "").split(" ").filter(Boolean));
    else if (part.classList.contains("island__more-chip")) ids.push("more");
    else if (part.classList.contains("island__center-slot")) ids.push("center");
    else ids.push("text");
  }
  return ids;
}

export function measureBarWings(bar: HTMLElement | null): BarUsageWings | null {
  const left = bar?.querySelector(".island__notch-wing--left") ?? null;
  const right = bar?.querySelector(".island__notch-wing--right") ?? null;
  if (!left || !right) return null;
  return { left: readWing(left), right: readWing(right) };
}
