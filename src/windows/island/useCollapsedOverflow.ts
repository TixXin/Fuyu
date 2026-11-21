import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { collapsedFit } from "./collapsedFitStore";
import { fitCollapsedZones, type OverflowSide } from "./collapsedOverflow";
import { NOTCH_WING } from "./notch";

export type OverflowUnit = { key: string; ids: readonly string[]; movable?: boolean };
export type CollapsedOverflowState = { fitting: boolean; shelved: ReadonlySet<string>; moved: ReadonlySet<string>; chip: OverflowSide | null };

export const BAR_UNIT = "data-bar-unit";
export const MORE_CHIP_CLASS = "island__more-chip";
const MORE_CHIP_WIDTH = 28;
const HOLD_ID = "overflow:hold";
const HOLD_WIDTH = 400;
const SIDES: readonly OverflowSide[] = ["left", "right"];
const NONE: CollapsedOverflowState = { fitting: false, shelved: new Set(), moved: new Set(), chip: null };

function ownWidth(element: Element) {
  if (!(element instanceof HTMLElement)) return element.getBoundingClientRect().width;
  const inner = element.matches(".island__collapsed-fit") ? element.firstElementChild : element.querySelector(".island__collapsed-fit-inner");
  return Math.max(element.offsetWidth, element.scrollWidth, inner instanceof HTMLElement ? inner.offsetWidth : 0);
}

const px = (value: string) => Number.parseFloat(value) || 0;
const isOpenButton = (element: Element) => element.classList.contains("island__open-button");
const isMoreChip = (element: Element) => element.classList.contains(MORE_CHIP_CLASS);

function flexBoxes(children: Iterable<Element>): Element[] {
  const boxes: Element[] = [];
  for (const child of children) {
    if (child.hasAttribute(BAR_UNIT)) boxes.push(...flexBoxes(child.children));
    else if (!isMoreChip(child) && child.getClientRects().length > 0) boxes.push(child);
  }
  return boxes;
}

function boxWidth(element: Element) {
  if (!isOpenButton(element)) return ownWidth(element);
  const style = getComputedStyle(element);
  return px(style.paddingLeft) + px(style.paddingRight);
}

const spanOf = (boxes: readonly Element[], gap: number) =>
  boxes.reduce((total, box) => total + boxWidth(box), 0) + gap * Math.max(0, boxes.length - 1);

function measureWing(wing: HTMLElement) {
  const style = getComputedStyle(wing);
  const gap = px(style.columnGap);
  const bar = wing.closest(".island__collapsed");
  const pads = px(style.paddingLeft) + px(style.paddingRight) + (bar ? px(getComputedStyle(bar).paddingLeft) : 0);
  const fixed = flexBoxes([...wing.children].filter((child) => !child.hasAttribute(BAR_UNIT)));
  const empty = [...wing.querySelectorAll(`[${BAR_UNIT}]`)].filter((unit) => {
    const boxes = flexBoxes(unit.children);
    return boxes.length > 0 && spanOf(boxes, gap) === 0;
  }).length;
  const reserved = pads + fixed.reduce((total, box) => total + boxWidth(box), 0) + gap * (fixed.length + empty);
  return { gap, reserved, content: wing.clientWidth - px(style.paddingLeft) - px(style.paddingRight) };
}

function isSqueezed(wing: HTMLElement) {
  const { gap, content } = measureWing(wing);
  return spanOf(flexBoxes(wing.children), gap) > content + 1;
}

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((id) => b.has(id));
const sameState = (a: CollapsedOverflowState, b: CollapsedOverflowState) =>
  a.fitting === b.fitting && a.chip === b.chip && sameSet(a.shelved, b.shelved) && sameSet(a.moved, b.moved);

export type CollapsedOverflowOptions = { auto: boolean; forceChip: boolean; maxWing: number };

export function useCollapsedOverflow(
  enabled: boolean,
  active: boolean,
  zones: Record<OverflowSide, readonly OverflowUnit[]>,
  refs: Record<OverflowSide, RefObject<HTMLElement | null>>,
  { auto, forceChip, maxWing }: CollapsedOverflowOptions,
): CollapsedOverflowState {
  const [state, setState] = useState(NONE);
  const widthsRef = useRef(new Map<string, number>());
  const zonesRef = useRef(zones);
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    zonesRef.current = zones;
    stateRef.current = state;
  });
  const signature = SIDES.map((side) => zones[side].map((unit) => unit.key).join(",")).join("|");
  const leftRef = refs.left;
  const rightRef = refs.right;

  useLayoutEffect(() => {
    if (!enabled) {
      setState((current) => (current === NONE ? current : NONE));
      return;
    }
    if (!active) return;
    const wings = { left: leftRef.current, right: rightRef.current };
    const left = wings.left;
    const right = wings.right;
    if (!left || !right) return;

    const evaluate = () => {
      const current = stateRef.current;
      if (!current.fitting) {
        if (forceChip || (auto && (isSqueezed(left) || isSqueezed(right)))) setState({ ...NONE, fitting: true });
        return;
      }
      const units = zonesRef.current;
      const widths = widthsRef.current;
      const known = new Set(SIDES.flatMap((side) => units[side].map((unit) => unit.key)));
      for (const key of [...widths.keys()]) if (!known.has(key)) widths.delete(key);
      const measured = { left: measureWing(left), right: measureWing(right) };
      for (const side of SIDES) {
        const wing = side === "left" ? left : right;
        for (const node of wing.querySelectorAll(`[${BAR_UNIT}]`)) {
          widths.set(node.getAttribute(BAR_UNIT) ?? "", spanOf(flexBoxes(node.children), measured[side].gap));
        }
      }
      const zone = (side: OverflowSide) => ({
        widths: units[side].map((unit) => widths.get(unit.key) ?? 0),
        capacity: maxWing - measured[side].reserved,
        movable: units[side].map((unit) => unit.movable === true),
      });
      const fit = fitCollapsedZones(zone("left"), zone("right"), measured.left.gap, MORE_CHIP_WIDTH, { auto, forceChip });
      const shelved = new Set<string>();
      const moved = new Set<string>();
      for (const side of SIDES) fit[side].forEach((away, index) => {
        if (away) for (const id of units[side][index].ids) shelved.add(id);
        if (fit.moved[side][index]) moved.add(units[side][index].key);
      });
      const fitsNarrow = SIDES.every((side) => fit.used[side] <= NOTCH_WING - measured[side].reserved);
      const next: CollapsedOverflowState = shelved.size === 0 && moved.size === 0 && !forceChip && fitsNarrow ? NONE : { fitting: true, shelved, moved, chip: fit.chip };
      if (!sameState(current, next)) setState(next);
    };

    evaluate();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(evaluate);
    for (const wing of [left, right]) {
      observer.observe(wing);
      for (const node of wing.querySelectorAll(`:scope > *, [${BAR_UNIT}] > *, .island__collapsed-fit-inner`)) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [enabled, active, signature, state, leftRef, rightRef, auto, forceChip, maxWing]);

  useEffect(() => {
    if (!state.fitting) return;
    collapsedFit.report(HOLD_ID, HOLD_WIDTH);
    return () => collapsedFit.drop(HOLD_ID);
  }, [state.fitting]);

  return state;
}
