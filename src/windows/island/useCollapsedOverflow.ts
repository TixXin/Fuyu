import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { collapsedFit } from "./collapsedFitStore";
import { balancedLanes, fitCollapsedZones, isUnbalanced, leastWing, NOTCH_SIDE_LEAST, resolveUnitWidth, type OverflowSide } from "./collapsedOverflow";
import { NOTCH_WING, reportNotchWing } from "./notch";
import { MAX_NOTCH_WING_MAX } from "../../lib/settings/settingsLimits";

export type OverflowUnit = { key: string; ids: readonly string[]; movable?: boolean; keep?: boolean };
export type CollapsedOverflowState = { fitting: boolean; shelved: ReadonlySet<string>; moved: ReadonlySet<string>; chip: OverflowSide | null; wing: number | null };
export type UnitWidthTracker = { hydrated: WeakSet<Element>; mountedAt: WeakMap<Element, number> };

export const BAR_UNIT = "data-bar-unit";
export const MORE_CHIP_CLASS = "island__more-chip";
export const MORE_CHIP_WIDTH = 28;
const HOLD_ID = "overflow:hold";
const HOLD_WIDTH = 400;
const SIDES: readonly OverflowSide[] = ["left", "right"];
const NONE: CollapsedOverflowState = { fitting: false, shelved: new Set(), moved: new Set(), chip: null, wing: null };
const NO_HYDRATING: ReadonlySet<string> = new Set();

export function createUnitWidthTracker(): UnitWidthTracker {
  return { hydrated: new WeakSet(), mountedAt: new WeakMap() };
}

function layoutWidth(element: HTMLElement) {
  const rect = element.getBoundingClientRect().width;
  if (!(rect > 0)) return 0;
  const bar = element.closest<HTMLElement>(".island__collapsed");
  const scale = bar && bar.offsetWidth > 0 ? bar.getBoundingClientRect().width / bar.offsetWidth : 1;
  return Math.ceil(rect / (scale > 0.01 ? scale : 1) - 0.01);
}

export function ownWidth(element: Element) {
  if (!(element instanceof HTMLElement)) return element.getBoundingClientRect().width;
  const inner = element.matches(".island__collapsed-fit") ? element.firstElementChild : element.querySelector(".island__collapsed-fit-inner");
  const natural = inner instanceof HTMLElement ? Math.max(inner.offsetWidth, layoutWidth(inner)) : 0;
  return Math.max(element.offsetWidth, element.scrollWidth, natural);
}

export const px = (value: string) => Number.parseFloat(value) || 0;
export const isOpenButton = (element: Element) => element.classList.contains("island__open-button");
export const isMoreChip = (element: Element) => element.classList.contains(MORE_CHIP_CLASS);
const isBarControl = (element: Element) => isOpenButton(element) || element.classList.contains("island__quiet-button");

export function flexBoxes(children: Iterable<Element>): Element[] {
  const boxes: Element[] = [];
  for (const child of children) {
    if (child.hasAttribute(BAR_UNIT)) boxes.push(...flexBoxes(child.children));
    else if (!isMoreChip(child) && child.getClientRects().length > 0) boxes.push(child);
  }
  return boxes;
}

export function boxWidth(element: Element) {
  if (!isOpenButton(element)) return ownWidth(element);
  const style = getComputedStyle(element);
  return px(style.paddingLeft) + px(style.paddingRight);
}

export const spanOf = (boxes: readonly Element[], gap: number) =>
  boxes.reduce((total, box) => total + boxWidth(box), 0) + gap * Math.max(0, boxes.length - 1);

export function seedUnitWidths(container: ParentNode, units: readonly OverflowUnit[], widths: Map<string, number>, gap: number) {
  const fitById = new Map<string, Element>();
  for (const node of container.querySelectorAll("[data-fit-item]")) {
    const id = node.getAttribute("data-fit-item");
    if (id && node.getClientRects().length > 0) fitById.set(id, node);
  }
  for (const unit of units) {
    const boxes: Element[] = [];
    for (const id of unit.ids) {
      const node = fitById.get(id);
      if (node) boxes.push(node);
    }
    if (boxes.length === 0) continue;
    const width = spanOf(boxes, gap);
    if (width > 0) widths.set(unit.key, width);
  }
}

export function measureBarUnits(
  containers: readonly { root: HTMLElement; gap: number }[],
  widths: Map<string, number>,
  tracker: UnitWidthTracker,
  now = performance.now(),
) {
  const hydrating = new Set<string>();
  let retryIn: number | null = null;
  for (const { root, gap } of containers) {
    for (const node of root.querySelectorAll(`[${BAR_UNIT}]`)) {
      const key = node.getAttribute(BAR_UNIT) ?? "";
      let mountedAt = tracker.mountedAt.get(node);
      if (mountedAt === undefined) {
        mountedAt = now;
        tracker.mountedAt.set(node, mountedAt);
      }
      const raw = spanOf(flexBoxes(node.children), gap);
      const resolved = resolveUnitWidth(raw, widths.get(key) ?? 0, tracker.hydrated.has(node), mountedAt, now);
      if (raw > 0) tracker.hydrated.add(node);
      widths.set(key, resolved.width);
      if (resolved.hydrating) hydrating.add(key);
      if (resolved.retryIn !== null) retryIn = retryIn === null ? resolved.retryIn : Math.min(retryIn, resolved.retryIn);
    }
  }
  return { hydrating, retryIn };
}

function measureWing(wing: HTMLElement, hydrating: ReadonlySet<string> = NO_HYDRATING) {
  const style = getComputedStyle(wing);
  const gap = px(style.columnGap);
  const bar = wing.closest(".island__collapsed");
  const pads = px(style.paddingLeft) + px(style.paddingRight) + (bar ? px(getComputedStyle(bar).paddingLeft) : 0);
  const fixed = flexBoxes([...wing.children].filter((child) => !child.hasAttribute(BAR_UNIT)));
  const empty = [...wing.querySelectorAll(`[${BAR_UNIT}]`)].filter((unit) => {
    if (hydrating.has(unit.getAttribute(BAR_UNIT) ?? "")) return false;
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

const itemCount = (wing: HTMLElement) => flexBoxes(wing.children).filter((box) => !isBarControl(box) && ownWidth(box) > 0).length;

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((id) => b.has(id));
const sameState = (a: CollapsedOverflowState, b: CollapsedOverflowState) =>
  a.fitting === b.fitting && a.chip === b.chip && a.wing === b.wing && sameSet(a.shelved, b.shelved) && sameSet(a.moved, b.moved);

export function useOverflowHold(fitting: boolean, id = HOLD_ID) {
  useEffect(() => {
    if (!fitting) return;
    collapsedFit.hold(id, HOLD_WIDTH);
    return () => collapsedFit.drop(id);
  }, [fitting, id]);
}

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
  const trackerRef = useRef<UnitWidthTracker | null>(null);
  if (trackerRef.current === null) trackerRef.current = createUnitWidthTracker();
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
    const tracker = trackerRef.current!;
    let retryTimer: number | undefined;

    const evaluate = () => {
      window.clearTimeout(retryTimer);
      retryTimer = undefined;
      const current = stateRef.current;
      if (!current.fitting) {
        if (forceChip || isUnbalanced(itemCount(left), itemCount(right)) || (auto && (isSqueezed(left) || isSqueezed(right)))) {
          seedUnitWidths(left, zonesRef.current.left, widthsRef.current, px(getComputedStyle(left).columnGap));
          seedUnitWidths(right, zonesRef.current.right, widthsRef.current, px(getComputedStyle(right).columnGap));
          setState({ ...NONE, fitting: true });
        }
        return;
      }
      const units = zonesRef.current;
      const widths = widthsRef.current;
      const known = new Set(SIDES.flatMap((side) => units[side].map((unit) => unit.key)));
      for (const key of [...widths.keys()]) if (!known.has(key)) widths.delete(key);
      const gaps = { left: px(getComputedStyle(left).columnGap), right: px(getComputedStyle(right).columnGap) };
      const { hydrating, retryIn } = measureBarUnits(
        [{ root: left, gap: gaps.left }, { root: right, gap: gaps.right }],
        widths,
        tracker,
      );
      if (retryIn !== null) retryTimer = window.setTimeout(evaluate, Math.ceil(retryIn) + 1);
      const measured = { left: measureWing(left, hydrating), right: measureWing(right, hydrating) };
      const sized = { left: units.left.map((unit) => widths.get(unit.key) ?? 0), right: units.right.map((unit) => widths.get(unit.key) ?? 0) };
      const reserved = { left: measured.left.reserved, right: measured.right.reserved };
      const least = leastWing(balancedLanes(sized.left, sized.right, NOTCH_SIDE_LEAST), reserved, measured.left.gap, MORE_CHIP_WIDTH, NOTCH_SIDE_LEAST, forceChip);
      const wing = Math.min(Math.max(maxWing, MAX_NOTCH_WING_MAX), Math.max(maxWing, Math.ceil(least)));
      const zone = (side: OverflowSide) => ({
        widths: sized[side],
        capacity: wing - reserved[side],
        movable: units[side].map((unit) => unit.movable === true),
        keep: units[side].map((unit) => unit.keep === true),
      });
      const fit = fitCollapsedZones(zone("left"), zone("right"), measured.left.gap, MORE_CHIP_WIDTH, { auto, forceChip, least: NOTCH_SIDE_LEAST });
      const shelved = new Set<string>();
      const moved = new Set<string>();
      for (const side of SIDES) fit[side].forEach((away, index) => {
        if (away) for (const id of units[side][index].ids) shelved.add(id);
        if (fit.moved[side][index]) moved.add(units[side][index].key);
      });
      const fitsNarrow = SIDES.every((side) => fit.used[side] <= NOTCH_WING - measured[side].reserved);
      const next: CollapsedOverflowState = shelved.size === 0 && moved.size === 0 && !forceChip && fitsNarrow ? NONE : { fitting: true, shelved, moved, chip: fit.chip, wing: wing > maxWing ? wing : null };
      if (!sameState(current, next)) setState(next);
    };

    evaluate();
    if (typeof ResizeObserver === "undefined") return () => window.clearTimeout(retryTimer);
    const observer = new ResizeObserver(evaluate);
    for (const wing of [left, right]) {
      observer.observe(wing);
      for (const node of wing.querySelectorAll(`:scope > *, [${BAR_UNIT}] > *, .island__collapsed-fit-inner`)) observer.observe(node);
    }
    return () => {
      window.clearTimeout(retryTimer);
      observer.disconnect();
    };
  }, [enabled, active, signature, state, leftRef, rightRef, auto, forceChip, maxWing]);

  useOverflowHold(state.fitting);

  useEffect(() => {
    reportNotchWing(state.wing);
    return () => reportNotchWing(null);
  }, [state.wing]);

  return state;
}
