import { useSyncExternalStore } from "react";
import { cellBox, type CustomPanel } from "../../../../lib/settings/customPanels.ts";
import { FUYU_ROWS } from "../panelSize.ts";

export type PagerTone = "target" | "pushed";
export type PagerBlock = { widget: string; left: number; top: number; width: number; height: number; tone?: PagerTone };
export type PagerHot = { kind: "page" | "all"; index: number; progress: number };
export type PagerPlacement = "header" | "dock";

export type PagerView = {
  pages: PagerBlock[][];
  page: number;
  dragging: boolean;
  canAdd: boolean;
  overview: boolean;
  hot: PagerHot | null;
  placement: PagerPlacement;
  onPick: (page: number) => void;
};

export function pagerBlocks(panel: CustomPanel, pageCount: number, pageColumns: number, target: string | null, pushed: ReadonlySet<string>): PagerBlock[][] {
  const pages: PagerBlock[][] = Array.from({ length: pageCount }, () => []);
  for (const item of panel.items) {
    const box = cellBox(item);
    const page = Math.floor(box.col / pageColumns);
    const tone = item.widget === target ? "target" : pushed.has(item.widget) ? "pushed" : undefined;
    pages[page]?.push({
      widget: item.widget,
      left: (box.col - page * pageColumns) / pageColumns,
      top: box.row / FUYU_ROWS,
      width: box.cols / pageColumns,
      height: box.rows / FUYU_ROWS,
      ...(tone ? { tone } : {}),
    });
  }
  return pages;
}

let view: PagerView | null = null;
const listeners = new Set<() => void>();

export function publishPager(next: PagerView | null) {
  if (next === view) return;
  view = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePagerView(): PagerView | null {
  return useSyncExternalStore(subscribe, () => view, () => null);
}
