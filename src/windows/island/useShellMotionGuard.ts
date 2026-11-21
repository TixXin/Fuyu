import { useEffect, useRef, type RefObject } from "react";
import { isMacOS } from "../../lib/platform";

const SHELL_PROPS = new Set([
  "--island-shell-width",
  "--island-shell-height",
  "--island-shell-top-corner",
  "--island-shell-bottom-corner",
]);

type ShellValues = Record<string, string>;

function readShell(element: HTMLElement): ShellValues {
  const style = getComputedStyle(element);
  return Object.fromEntries([...SHELL_PROPS].map((property) => [property, style.getPropertyValue(property).trim()]));
}

function coverShellTransitions(element: HTMLElement, rest: ShellValues | null): Animation[] {
  const now = document.timeline.currentTime;
  const covers: Animation[] = [];
  for (const animation of element.getAnimations()) {
    if (!(animation instanceof CSSTransition) || !SHELL_PROPS.has(animation.transitionProperty)) continue;
    const effect = animation.effect;
    if (!(effect instanceof KeyframeEffect)) continue;
    const property = animation.transitionProperty;
    const keyframes = effect.getKeyframes();
    const first = keyframes[0];
    const last = keyframes[keyframes.length - 1];
    const from = first ? String(first[property]) : rest?.[property];
    const to = last ? String(last[property]) : getComputedStyle(element).getPropertyValue(property).trim();
    if (!from || !to || from === to) continue;
    const timing = effect.getTiming();
    const easing = first?.easing && first.easing !== "linear" ? first.easing : timing.easing;
    const cover = element.animate([{ [property]: from }, { [property]: to }], {
      duration: timing.duration,
      delay: timing.delay,
      easing,
      fill: "backwards",
    });
    cover.startTime = now;
    covers.push(cover);
  }
  return covers;
}

export function useShellMotionGuard(shellRef: RefObject<HTMLElement | null>, mode: string) {
  const rest = useRef<ShellValues | null>(null);
  const covers = useRef<Animation[]>([]);
  const settled = useRef(false);

  useEffect(() => {
    const element = shellRef.current;
    if (!isMacOS || !element) return;
    const frame = requestAnimationFrame(() => {
      if (!settled.current) {
        settled.current = true;
        rest.current = readShell(element);
        return;
      }
      for (const cover of covers.current) cover.cancel();
      const next = coverShellTransitions(element, rest.current);
      covers.current = next;
      if (next.length === 0) {
        rest.current = readShell(element);
        return;
      }
      void Promise.all(next.map((cover) => cover.finished)).then(
        () => {
          if (covers.current === next) rest.current = readShell(element);
        },
        () => {},
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [shellRef, mode]);
}
