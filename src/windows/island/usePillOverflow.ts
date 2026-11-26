import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { fitPill, pillWidestWidth } from "./collapsedOverflow";
import { BAR_UNIT, boxWidth, createUnitWidthTracker, flexBoxes, isMoreChip, isOpenButton, measureBarUnits, MORE_CHIP_WIDTH, px, seedUnitWidths, useOverflowHold, type CollapsedOverflowState, type OverflowUnit, type UnitWidthTracker } from "./useCollapsedOverflow";

export const PILL_TEXT_FLOOR = 160;

const PILL_HOLD_ID = "overflow:hold:pill";
const NONE: CollapsedOverflowState = { fitting: false, shelved: new Set(), moved: new Set(), chip: null, wing: null };

function inFlow(element: Element) {
  if (element.getClientRects().length === 0) return false;
  const position = getComputedStyle(element).position;
  return position !== "absolute" && position !== "fixed";
}

function naturalWidth(element: Element) {
  let widest = element.scrollWidth;
  for (const inner of element.querySelectorAll("*")) widest = Math.max(widest, inner.scrollWidth);
  return widest;
}

function measureBar(bar: HTMLElement) {
  const style = getComputedStyle(bar);
  const gap = px(style.columnGap);
  const children = [...bar.children].filter(inFlow);
  const open = children.find(isOpenButton);
  const openStyle = open ? getComputedStyle(open) : null;
  const openPad = openStyle ? px(openStyle.paddingLeft) + px(openStyle.paddingRight) : 0;
  const text = open && open.textContent?.trim() ? Math.min(PILL_TEXT_FLOOR, naturalWidth(open) - openPad) : 0;
  const base = px(style.paddingLeft) + px(style.paddingRight) + openPad + text;
  const cost = (boxes: readonly Element[]) => boxes.reduce((total, box) => total + boxWidth(box) + gap, 0);
  const rest = children.filter((child) => !isOpenButton(child));
  return {
    gap,
    width: bar.clientWidth,
    widest: pillWidestWidth(bar.clientWidth, bar.offsetWidth, bar.getBoundingClientRect().width),
    need: base + cost(flexBoxes(rest)) + cost(rest.filter(isMoreChip)),
    reserved: base + cost(flexBoxes(rest.filter((child) => !child.hasAttribute(BAR_UNIT) && !isMoreChip(child)))),
  };
}

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((id) => b.has(id));

export function usePillOverflow(enabled: boolean, active: boolean, units: readonly OverflowUnit[], barRef: RefObject<HTMLElement | null>, { auto, keepChip, hasText = false }: { auto: boolean; keepChip: boolean; hasText?: boolean }): CollapsedOverflowState {
  const [state, setState] = useState(NONE);
  const widthsRef = useRef(new Map<string, number>());
  const trackerRef = useRef<UnitWidthTracker | null>(null);
  if (trackerRef.current === null) trackerRef.current = createUnitWidthTracker();
  const unitsRef = useRef(units);
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    unitsRef.current = units;
    stateRef.current = state;
  });
  const signature = units.map((unit) => unit.key).join(",");

  useLayoutEffect(() => {
    if (active) return;
    widthsRef.current.clear();
    setState((current) => (current === NONE ? current : NONE));
  }, [active]);

  useLayoutEffect(() => {
    if (!enabled) {
      setState((current) => (current === NONE ? current : NONE));
      return;
    }
    const bar = barRef.current;
    if (!active || !bar) return;
    const tracker = trackerRef.current!;
    let retryTimer: number | undefined;

    const evaluate = () => {
      window.clearTimeout(retryTimer);
      retryTimer = undefined;
      if (bar.clientWidth === 0) return;
      const current = stateRef.current;
      const measured = measureBar(bar);
      const list = unitsRef.current;
      const widths = widthsRef.current;
      const known = new Set(list.map((unit) => unit.key));
      for (const key of [...widths.keys()]) if (!known.has(key)) widths.delete(key);
      if (!current.fitting) {
        if (auto && measured.need > measured.widest + 1) {
          seedUnitWidths(bar, list, widths, measured.gap);
          setState({ ...NONE, fitting: true, chip: "right" });
        }
        return;
      }
      const { retryIn } = measureBarUnits([{ root: bar, gap: measured.gap }], widths, tracker);
      if (retryIn !== null) retryTimer = window.setTimeout(evaluate, Math.ceil(retryIn) + 1);
      const fit = fitPill(list.map((unit) => widths.get(unit.key) ?? 0), measured.width - measured.reserved, measured.gap, MORE_CHIP_WIDTH, { auto, forceChip: keepChip });
      const shelved = new Set<string>();
      fit.away.forEach((away, index) => {
        if (away) for (const id of list[index].ids) shelved.add(id);
      });
      const next: CollapsedOverflowState = shelved.size > 0 ? { fitting: true, shelved, moved: NONE.moved, chip: "right", wing: null } : NONE;
      if (next.fitting !== current.fitting || next.chip !== current.chip || !sameSet(next.shelved, current.shelved)) setState(next);
    };

    evaluate();
    if (typeof ResizeObserver === "undefined") return () => window.clearTimeout(retryTimer);
    const observer = new ResizeObserver(evaluate);
    observer.observe(bar);
    for (const node of bar.querySelectorAll(`:scope > *, [${BAR_UNIT}] > *, .island__collapsed-fit-inner`)) observer.observe(node);
    return () => {
      window.clearTimeout(retryTimer);
      observer.disconnect();
    };
  }, [enabled, active, signature, state, barRef, auto, keepChip, hasText]);

  useOverflowHold(state.fitting, PILL_HOLD_ID);
  return state;
}
