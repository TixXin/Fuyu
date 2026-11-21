import { springResponse } from "../../../../lib/theme/motionCurves.ts";

export const ENTRANCE_DATA_MS = 800;
const COUNT_MS = 650;
const LEAD_MS = 40;
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const POP_MS = 520;
const POP = springResponse(0.5, 24, POP_MS);
const SELECTORS = {
  count: ".sys-ring__circle > span, .sys-battery__level, .daily-year__value, .daily-countdown__value, .sys-network__rows b, [data-enter='count']",
  sweep: ".sys-ring__value, [data-enter='sweep']",
  draw: ".daily-ring__track, .sys-network__spark polyline, .daily-sun__path, [data-enter='draw']",
  fillX: ".sys-battery__bar b, [data-enter='fill-x']",
  fillY: ".daily-water__cup b, .daily-focus__bars b, [data-enter='fill-y']",
  cell: ".daily-year__months i, .daily-heat__cell, .daily-habits__cell, [data-enter='cell']",
  pop: ".daily-button, [data-enter='pop']",
  mascot: ".daily-today__foot > :first-child",
};

export const ENTRANCE_MASCOT_SELECTOR = SELECTORS.mascot;

export function countText(target: string, progress: number): string {
  const match = /^(\s*)(\d+)([^]*)$/.exec(target);
  if (!match || /^[.,:]\d/.test(match[3])) return target;
  const [, lead, digits, rest] = match;
  const to = Number(digits);
  const from = digits.length > 1 ? 10 ** (digits.length - 1) : 0;
  if (to <= from) return target;
  const eased = 1 - (1 - Math.min(1, Math.max(0, progress))) ** 3;
  return `${lead}${Math.round(from + (to - from) * eased)}${rest}`;
}

type Counter = { element: Element; begin: number; target: string; shown: string };

const numberNode = (element: Element) => Array.from(element.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && /\d/.test(node.nodeValue ?? ""));

function startCounters(counters: Counter[]): () => void {
  let frame = 0;
  const write = (counter: Counter, text: string) => {
    const node = numberNode(counter.element);
    if (!node) return false;
    if (node.nodeValue !== counter.shown) counter.target = node.nodeValue ?? counter.target;
    counter.shown = text === "" ? counter.target : text;
    node.nodeValue = counter.shown;
    return true;
  };
  const tick = (now: number) => {
    for (let at = counters.length - 1; at >= 0; at--) {
      const counter = counters[at];
      const progress = (now - counter.begin) / COUNT_MS;
      const node = numberNode(counter.element);
      if (node && node.nodeValue !== counter.shown) counter.target = node.nodeValue ?? counter.target;
      if (progress >= 1 || !write(counter, countText(counter.target, progress))) {
        write(counter, "");
        counters.splice(at, 1);
      }
    }
    frame = counters.length > 0 ? requestAnimationFrame(tick) : 0;
  };
  for (const counter of counters) write(counter, countText(counter.target, 0));
  if (counters.length > 0) frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
    for (const counter of counters) write(counter, "");
    counters.length = 0;
  };
}

export function playEntranceData(cells: readonly (Element | null)[], ready: readonly number[], ownMascot: boolean): () => void {
  const animations: Animation[] = [];
  const counters: Counter[] = [];
  const now = performance.now();
  const play = (element: Element, frames: Keyframe[], delay: number, duration: number, easing = EASE_OUT) => {
    animations.push(element.animate(frames, { delay, duration, easing, fill: "backwards" }));
  };
  cells.forEach((cell, card) => {
    if (!cell) return;
    const at = (ready[card] ?? 0) + LEAD_MS;
    const all = <T extends Element>(selector: string) => Array.from(cell.querySelectorAll<T>(selector));
    for (const element of all(SELECTORS.count)) {
      const target = numberNode(element)?.nodeValue;
      if (target && countText(target, 0) !== target) counters.push({ element, begin: now + at, target, shown: target });
    }
    for (const element of all<SVGGeometryElement>(SELECTORS.sweep)) play(element, [{ strokeDasharray: `0 ${element.getTotalLength()}`, offset: 0 }], at, 750);
    for (const element of all<SVGGeometryElement>(SELECTORS.draw)) {
      const length = element.getTotalLength();
      play(element, [{ strokeDasharray: `0 ${length}` }, { strokeDasharray: `${length} ${length}` }], at, 700);
    }
    for (const element of all(SELECTORS.fillX)) play(element, [{ transform: "scaleX(0)", transformOrigin: "0 50%" }, { transform: "scaleX(1)", transformOrigin: "0 50%" }], at, 650);
    for (const element of all(SELECTORS.fillY)) play(element, [{ transform: "scaleY(0)", transformOrigin: "50% 100%" }, { transform: "scaleY(1)", transformOrigin: "50% 100%" }], at, 650);
    const dots = all<HTMLElement>(SELECTORS.cell);
    const first = Math.min(...dots.map((dot) => dot.offsetLeft + dot.offsetTop));
    for (const dot of dots) play(dot, [{ opacity: 0.12, transform: "scale(0.4)", offset: 0 }], at + Math.min(320, (dot.offsetLeft + dot.offsetTop - first) * 2.2), 220);
    for (const element of all(SELECTORS.pop)) play(element, [{ opacity: 0, transform: "scale(0.4)" }, { opacity: 1, transform: "scale(1)" }], at + 160, POP_MS, POP);
    if (!ownMascot) {
      for (const element of all(SELECTORS.mascot)) play(element, [{ opacity: 0, transform: "translateY(10px) scale(0.6)", transformOrigin: "50% 100%" }, { opacity: 1, transform: "none", transformOrigin: "50% 100%" }], at + 60, POP_MS, POP);
    }
  });
  const stopCounters = startCounters(counters);
  return () => {
    for (const animation of animations) animation.cancel();
    stopCounters();
  };
}
