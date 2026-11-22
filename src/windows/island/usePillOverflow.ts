import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { fitPill } from "./collapsedOverflow";
import { MAX_FITTED_COLLAPSED_WIDTH } from "./layout";
import { BAR_UNIT, boxWidth, flexBoxes, isMoreChip, isOpenButton, MORE_CHIP_WIDTH, px, spanOf, useOverflowHold, type CollapsedOverflowState, type OverflowUnit } from "./useCollapsedOverflow";

export const PILL_TEXT_FLOOR = 160;

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
  const island = bar.closest<HTMLElement>(".island")?.offsetWidth ?? bar.offsetWidth;
  return {
    gap,
    width: bar.clientWidth,
    widest: bar.clientWidth + Math.max(0, MAX_FITTED_COLLAPSED_WIDTH - island),
    need: base + cost(flexBoxes(rest)) + cost(rest.filter(isMoreChip)),
    reserved: base + cost(flexBoxes(rest.filter((child) => !child.hasAttribute(BAR_UNIT) && !isMoreChip(child)))),
  };
}

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((id) => b.has(id));

export function usePillOverflow(enabled: boolean, active: boolean, units: readonly OverflowUnit[], barRef: RefObject<HTMLElement | null>, { auto, keepChip }: { auto: boolean; keepChip: boolean }): CollapsedOverflowState {
  const [state, setState] = useState(NONE);
  const widthsRef = useRef(new Map<string, number>());
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

    const evaluate = () => {
      if (bar.clientWidth === 0) return;
      const current = stateRef.current;
      const measured = measureBar(bar);
      const list = unitsRef.current;
      const widths = widthsRef.current;
      const known = new Set(list.map((unit) => unit.key));
      for (const key of [...widths.keys()]) if (!known.has(key)) widths.delete(key);
      for (const node of bar.querySelectorAll(`[${BAR_UNIT}]`)) widths.set(node.getAttribute(BAR_UNIT) ?? "", spanOf(flexBoxes(node.children), measured.gap));
      const pack = (room: number) => fitPill(list.map((unit) => widths.get(unit.key) ?? 0), room - measured.reserved, measured.gap, MORE_CHIP_WIDTH, { auto, forceChip: keepChip });
      if (!current.fitting) {
        if (auto && measured.need > measured.widest + 1) setState({ ...NONE, fitting: true, chip: "right" });
        return;
      }
      const fit = pack(measured.width);
      const shelved = new Set<string>();
      fit.away.forEach((away, index) => {
        if (away) for (const id of list[index].ids) shelved.add(id);
      });
      const next: CollapsedOverflowState = shelved.size > 0 ? { fitting: true, shelved, moved: NONE.moved, chip: "right", wing: null } : NONE;
      if (next.fitting !== current.fitting || next.chip !== current.chip || !sameSet(next.shelved, current.shelved)) setState(next);
    };

    evaluate();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(evaluate);
    observer.observe(bar);
    for (const node of bar.querySelectorAll(`:scope > *, [${BAR_UNIT}] > *, .island__collapsed-fit-inner`)) observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, active, signature, state, barRef, auto, keepChip]);

  useOverflowHold(state.fitting);
  return state;
}
