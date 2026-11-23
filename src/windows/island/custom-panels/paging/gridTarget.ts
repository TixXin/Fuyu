import { cellBox, layoutStrip, stripInsertIndexAt, type CustomPanel, type PanelItem } from "../../../../lib/settings/customPanels.ts";
import { FUYU_ROWS } from "../panelSize.ts";

export type GridTarget = { panel: CustomPanel; page: number; fresh: boolean };
export type DropSpot =
  | { kind: "board"; x: number; y: number }
  | { kind: "page"; page: number }
  | { kind: "new" }
  | { kind: "tray" };

export const laidOut = (panel: CustomPanel, pageColumns: number, rows = FUYU_ROWS) => layoutStrip(panel, rows, pageColumns);

export const pageOfItem = (item: PanelItem, pageColumns: number) => Math.floor(cellBox(item).col / pageColumns);

export function pageCountOf(panel: CustomPanel, pageColumns: number): number {
  return panel.items.reduce((count, item) => {
    const box = cellBox(item);
    return Math.max(count, Math.floor((box.col + box.cols - 1) / pageColumns) + 1);
  }, 1);
}

function plain(item: PanelItem): PanelItem {
  const copy = { ...item };
  delete copy.pageBreak;
  return copy;
}

export function liftWidget(panel: CustomPanel, widget: string): { rest: CustomPanel; item: PanelItem } | null {
  const at = panel.items.findIndex((candidate) => candidate.widget === widget);
  const item = panel.items[at];
  if (!item) return null;
  const items = panel.items.filter((_, index) => index !== at);
  const follower = items[at];
  if (item.pageBreak && follower && !follower.pageBreak) items[at] = { ...follower, pageBreak: true };
  return { rest: { ...panel, items }, item: plain(item) };
}

function insert(rest: CustomPanel, item: PanelItem, index: number, pageBreak: boolean): CustomPanel {
  const placed = pageBreak ? { ...item, pageBreak: true as const } : item;
  return { ...rest, items: [...rest.items.slice(0, index), placed, ...rest.items.slice(index)] };
}

function settle(next: CustomPanel, widget: string, pageColumns: number, fresh: boolean, rows: number): GridTarget {
  const panel = laidOut(next, pageColumns, rows);
  const mine = panel.items.find((item) => item.widget === widget);
  return { panel, page: mine ? pageOfItem(mine, pageColumns) : 0, fresh };
}

export function onNewPage(rest: CustomPanel, item: PanelItem, pageColumns: number, rows = FUYU_ROWS): GridTarget {
  return settle(insert(rest, item, rest.items.length, rest.items.length > 0), item.widget, pageColumns, true, rows);
}

export function boardTarget(rest: CustomPanel, item: PanelItem, x: number, y: number, pageColumns: number, pageStepPx: number, rows = FUYU_ROWS): GridTarget {
  const laid = laidOut(rest, pageColumns, rows);
  const page = Math.max(0, Math.floor(x / pageStepPx));
  const last = rest.items.length > 0 ? pageCountOf(laid, pageColumns) - 1 : -1;
  if (page > last) return onNewPage(rest, item, pageColumns, rows);
  const target = settle(insert(rest, item, stripInsertIndexAt(laid, x, y, null), false), item.widget, pageColumns, false, rows);
  return target.page === page ? target : pageTarget(rest, item, page, pageColumns, rows);
}

export function pageTarget(rest: CustomPanel, item: PanelItem, page: number, pageColumns: number, rows = FUYU_ROWS): GridTarget {
  const laid = laidOut(rest, pageColumns, rows);
  let last = -1;
  laid.items.forEach((other, index) => {
    if (pageOfItem(other, pageColumns) === page) last = index;
  });
  if (last < 0) return onNewPage(rest, item, pageColumns, rows);
  for (let at = last + 1; at >= 0; at -= 1) {
    const target = settle(insert(rest, item, at, false), item.widget, pageColumns, false, rows);
    if (target.page === page) return target;
  }
  return settle(insert(rest, item, last + 1, false), item.widget, pageColumns, false, rows);
}

export function spotTarget(rest: CustomPanel, item: PanelItem, spot: DropSpot, pageColumns: number, pageStepPx: number, rows = FUYU_ROWS): GridTarget | null {
  if (spot.kind === "tray") return null;
  if (spot.kind === "new") return onNewPage(rest, item, pageColumns, rows);
  if (spot.kind === "page") return pageTarget(rest, item, spot.page, pageColumns, rows);
  return boardTarget(rest, item, spot.x, spot.y, pageColumns, pageStepPx, rows);
}

export function pushedWidgets(before: CustomPanel, after: CustomPanel, pageColumns: number, skip: string): string[] {
  const was = new Map(before.items.map((item) => [item.widget, pageOfItem(item, pageColumns)]));
  return after.items.filter((item) => item.widget !== skip && pageOfItem(item, pageColumns) > (was.get(item.widget) ?? Infinity)).map((item) => item.widget);
}

export function clearStrayBreak(panel: CustomPanel): CustomPanel {
  const first = panel.items[0];
  return first?.pageBreak ? { ...panel, items: [plain(first), ...panel.items.slice(1)] } : panel;
}
