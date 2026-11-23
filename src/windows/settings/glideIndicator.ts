import { indicatorDuration, indicatorFrames, type IndicatorSpan, type SwitchAxis } from "../../lib/theme/pageSwitch";
import type { PageSwitchIndicator } from "../../lib/settings/types";

export const ARRIVING_CLASS = "settings-switch-arriving";

export type IndicatorGlide = {
  container: HTMLElement;
  from: HTMLElement;
  to: HTMLElement;
  axis: SwitchAxis;
  mode: PageSwitchIndicator;
  speed: number;
  ghostClass: string;
  inset?: number;
};

const px = (value: number) => `${Math.round(value * 10) / 10}px`;

export function withoutTransition(element: HTMLElement, change?: () => void) {
  const before = element.style.transition;
  element.style.transition = "none";
  change?.();
  void getComputedStyle(element).backgroundColor;
  element.style.transition = before;
}

function spans(container: HTMLElement, element: HTMLElement, inset: number) {
  const box = container.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  return {
    x: { start: rect.left - box.left + container.scrollLeft + inset, size: rect.width - inset * 2 },
    y: { start: rect.top - box.top + container.scrollTop, size: rect.height },
  };
}

export function glideIndicator({ container, from, to, axis, mode, speed, ghostClass, inset = 0 }: IndicatorGlide): () => void {
  const start = spans(container, from, inset);
  const end = spans(container, to, inset);
  const plan = indicatorFrames(mode, start[axis], end[axis]);
  withoutTransition(from);
  if (!plan || typeof to.animate !== "function") return () => {};
  const [main, size] = axis === "x" ? ["left", "width"] : ["top", "height"];
  const crossAxis = axis === "y" ? "x" : null;
  const cross = (at: number): Record<string, string> => {
    if (!crossAxis) return {};
    const a: IndicatorSpan = start[crossAxis];
    const b: IndicatorSpan = end[crossAxis];
    return { left: px(a.start + (b.start - a.start) * at), width: px(a.size + (b.size - a.size) * at) };
  };
  const frames = plan.frames.map((span, index) => ({
    [main]: px(span.start),
    [size]: px(span.size),
    ...cross(plan.offsets[index]),
    offset: plan.offsets[index],
    ...(index < plan.easings.length ? { easing: plan.easings[index] } : {}),
  }));
  const ghost = document.createElement("span");
  ghost.className = ghostClass;
  ghost.setAttribute("aria-hidden", "true");
  container.append(ghost);
  to.classList.add(ARRIVING_CLASS);
  const animation = ghost.animate(frames, { duration: indicatorDuration(mode, speed), fill: "both" });
  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    withoutTransition(to, () => to.classList.remove(ARRIVING_CLASS));
    ghost.remove();
  };
  void animation.finished.then(settle, settle);
  return () => {
    animation.cancel();
    settle();
  };
}
