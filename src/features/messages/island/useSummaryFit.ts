import { useLayoutEffect, useState, useSyncExternalStore, type RefObject } from "react";
import { BAR_HEIGHT, fitGrow, INITIAL_FIT, stepFit, summaryGrow, type FitMeasure } from "./summaryFit.ts";

const TEXT = ".island-message-preview__sender, .island-message-preview__body";
const SCROLLER = ".island-message-preview__text, .island-message-preview__body";
const RECHECK_MS = 160;

function readMeasure(row: HTMLElement): FitMeasure {
  let deficit = 0;
  row.querySelectorAll<HTMLElement>(TEXT).forEach((element) => {
    deficit += Math.max(0, element.scrollWidth - element.clientWidth);
  });
  const scroller = row.querySelector<HTMLElement>(SCROLLER);
  const bar = Number.parseFloat(getComputedStyle(row).getPropertyValue("--collapsed-island-height")) || BAR_HEIGHT;
  return {
    deficit,
    available: row.clientWidth,
    chrome: scroller ? bar - scroller.clientHeight : 0,
    content: scroller ? scroller.scrollHeight : 0,
  };
}

export function useSummaryFit(rowRef: RefObject<HTMLElement | null>, key: string | null, active: boolean) {
  const [wrapped, setWrapped] = useState<string | null>(null);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!active || key === null || !row) return;
    let state = INITIAL_FIT;
    let timer = 0;
    const measure = () => {
      if (row.getClientRects().length === 0) return;
      const next = stepFit(state, readMeasure(row));
      if (next === state) return;
      const wraps = next.wrap && !state.wrap;
      state = next;
      if (wraps) setWrapped(key);
      summaryGrow.set(fitGrow(state));
      window.clearTimeout(timer);
      timer = window.setTimeout(measure, RECHECK_MS);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(row);
    row.querySelectorAll<HTMLElement>(SCROLLER).forEach((element) => observer?.observe(element));
    return () => {
      observer?.disconnect();
      window.clearTimeout(timer);
      summaryGrow.set(null);
    };
  }, [rowRef, key, active]);

  return wrapped !== null && wrapped === key && active;
}

export function useSummaryGrow() {
  return useSyncExternalStore(summaryGrow.subscribe, summaryGrow.get, summaryGrow.get);
}
