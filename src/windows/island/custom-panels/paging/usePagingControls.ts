import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { dwellKey, type DropHit } from "./dropHits";
import { OVERVIEW_DWELL_MS, PAGE_DWELL_MS, useDwell } from "./useDwell";
import { useEdgeFlip, type Pointer } from "./useEdgeFlip";
import { usePageNav, type PageNav } from "./usePageNav";
import { usePagingKeys } from "./usePagingKeys";
import type { PagerHot } from "./pagerStore";

type StateOptions = { scroller: RefObject<HTMLElement | null>; stepPx: number; enabled: boolean; dragging: boolean; reduced: boolean };

export type PagingState = ReturnType<typeof usePagingState>;

export function usePagingState({ scroller, stepPx, enabled, dragging, reduced }: StateOptions) {
  const nav = usePageNav(scroller, stepPx, enabled, dragging, reduced);
  const [overview, setOverview] = useState(false);
  const [floorTo, setFloorTo] = useState(-1);
  const cancelled = useRef(false);
  const addPage = useCallback((index: number) => setFloorTo((floor) => Math.max(floor, index)), []);
  const reset = useCallback(() => {
    setOverview(false);
    setFloorTo(-1);
  }, []);
  const cancel = useCallback(() => {
    cancelled.current = true;
    reset();
    const clear = () => {
      cancelled.current = false;
    };
    window.addEventListener("pointerdown", clear, { capture: true, once: true });
  }, [reset]);
  return { nav, overview, setOverview, floorPages: dragging ? Math.max(nav.page + 1, floorTo + 1) : 0, addPage, reset, cancel, cancelled: () => cancelled.current };
}

type InputOptions = {
  state: PagingState;
  pointer: Pointer | null;
  active: boolean;
  freeMove: boolean;
  hit: DropHit | null;
  pageCount: number;
  scroller: RefObject<HTMLElement | null>;
  stepPx: number;
  reduced: boolean;
  onCancel: () => void;
};

function flipTo(nav: PageNav, state: PagingState, next: number, pageCount: number) {
  if (next < 0) return;
  if (next < pageCount) return nav.goPage(next);
  state.addPage(next);
  window.requestAnimationFrame(() => nav.goPage(next));
}

export function usePagingInput({ state, pointer, active, freeMove, hit, pageCount, scroller, stepPx, reduced, onCancel }: InputOptions) {
  const { nav } = state;
  const pointerRef = useRef<Pointer | null>(pointer);
  useEffect(() => {
    pointerRef.current = pointer;
  });
  const edge = useEdgeFlip({
    active: (active && !state.overview) || freeMove,
    pointer: pointerRef,
    scroller,
    stepPx,
    nav,
    pageCount,
    canAdd: !freeMove,
    onAdd: () => state.addPage((nav.pageRef.current ?? 0) + 1),
    continuous: freeMove,
    reduced,
  });
  const key = active ? dwellKey(hit) : null;
  const progress = useDwell(key, key?.startsWith("all") ? OVERVIEW_DWELL_MS : PAGE_DWELL_MS, (fired) => {
    const [kind, index] = fired.split(":");
    if (kind === "all") state.setOverview(true);
    else if (Number(index) !== nav.pageRef.current) nav.goPage(Number(index));
  });
  usePagingKeys(active, {
    onCancel: () => {
      state.cancel();
      onCancel();
    },
    onFlip: (direction) => {
      if (!state.overview) flipTo(nav, state, nav.page + direction, pageCount);
    },
    onJump: (page) => {
      if (!state.overview && page < pageCount) nav.goPage(page);
    },
    onOverview: () => state.setOverview((open) => !open),
  });
  const hot: PagerHot | null = key && hit && (hit.kind === "page" || hit.kind === "all") ? { kind: hit.kind, index: hit.index, progress } : null;
  return { edge, hot };
}
