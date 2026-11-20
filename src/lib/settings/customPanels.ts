import { readString, removeItem, writeJson } from "../storage.ts";

export const CUSTOM_PANELS_KEY = "fuyu-custom-panels";
export const CUSTOM_PANEL_PAGE_PREFIX = "panel:";
const PANELS_VERSION = 1;

export const GRID_COLUMNS = 4;
export const GRID_CELL_PX = 120;
export const GRID_GAP_PX = 8;
export const GRID_UNIT_PX = 8;
const STEP = (GRID_CELL_PX + GRID_GAP_PX) / GRID_UNIT_PX;
const MAX_PANELS = 24;
const MAX_ITEMS = 48;
const MAX_NAME = 40;

export const PANEL_SIZES = ["s", "m", "l", "w"] as const;
export type PanelSize = (typeof PANEL_SIZES)[number];
export const PANEL_MODES = ["grid", "free"] as const;
export type PanelMode = (typeof PANEL_MODES)[number];

export const PANEL_ICONS = ["layout-grid", "star", "briefcase", "coffee", "music", "zap", "heart", "home", "gamepad", "book"] as const;
export type PanelIcon = (typeof PANEL_ICONS)[number];

export type PanelItem = { widget: string; size: PanelSize; x: number; y: number; w: number; h: number };
export type CustomPanel = { id: string; name: string; icon: PanelIcon; mode: PanelMode; items: PanelItem[] };

const CELLS: Record<PanelSize, { cols: number; rows: number }> = {
  s: { cols: 1, rows: 1 },
  m: { cols: 2, rows: 1 },
  l: { cols: 2, rows: 2 },
  w: { cols: 4, rows: 1 },
};

export const sizeCells = (size: PanelSize) => CELLS[size];
export const cellsToPx = (cells: number) => cells * GRID_CELL_PX + (cells - 1) * GRID_GAP_PX;
export const gridWidthPx = cellsToPx(GRID_COLUMNS);
export const panelPageId = (id: string) => `${CUSTOM_PANEL_PAGE_PREFIX}${id}`;
export const panelIdOfPage = (page: string) => (page.startsWith(CUSTOM_PANEL_PAGE_PREFIX) ? page.slice(CUSTOM_PANEL_PAGE_PREFIX.length) : null);

export type CellBox = { col: number; row: number; cols: number; rows: number };

export function cellBox(item: PanelItem): CellBox {
  const { cols, rows } = CELLS[item.size];
  return { col: Math.max(0, Math.round(item.x / STEP)), row: Math.max(0, Math.round(item.y / STEP)), cols, rows };
}

function placed(widget: string, size: PanelSize, col: number, row: number): PanelItem {
  const { cols, rows } = CELLS[size];
  return { widget, size, x: col * STEP, y: row * STEP, w: cols * STEP - 1, h: rows * STEP - 1 };
}

const isSize = (value: unknown): value is PanelSize => PANEL_SIZES.includes(value as PanelSize);
const isIcon = (value: unknown): value is PanelIcon => PANEL_ICONS.includes(value as PanelIcon);
const whole = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0);

function readItem(value: unknown): PanelItem | null {
  if (typeof value !== "object" || value === null) return null;
  const { widget, size, x, y, w, h } = value as Record<string, unknown>;
  if (typeof widget !== "string" || widget === "" || !isSize(size)) return null;
  const base = placed(widget, size, 0, 0);
  return { widget, size, x: whole(x), y: whole(y), w: typeof w === "number" ? whole(w) || base.w : base.w, h: typeof h === "number" ? whole(h) || base.h : base.h };
}

function cleanPanelName(name: unknown): string {
  return typeof name === "string" ? name.trim().slice(0, MAX_NAME) : "";
}

function readPanel(value: unknown): CustomPanel | null {
  if (typeof value !== "object" || value === null) return null;
  const { id, name, icon, mode, items } = value as Record<string, unknown>;
  if (typeof id !== "string" || id === "") return null;
  const list = Array.isArray(items) ? items.map(readItem).filter((item): item is PanelItem => item !== null).slice(0, MAX_ITEMS) : [];
  return { id, name: cleanPanelName(name), icon: isIcon(icon) ? icon : PANEL_ICONS[0], mode: mode === "free" ? "free" : "grid", items: list };
}

export function readCustomPanels(raw: string | null): CustomPanel[] {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (typeof value !== "object" || value === null || (value as { version?: unknown }).version !== PANELS_VERSION) return [];
    const panels = (value as { panels?: unknown }).panels;
    if (!Array.isArray(panels)) return [];
    const seen = new Set<string>();
    return panels.map(readPanel).filter((panel): panel is CustomPanel => panel !== null && !seen.has(panel.id) && Boolean(seen.add(panel.id))).slice(0, MAX_PANELS);
  } catch {
    return [];
  }
}

export function loadCustomPanels(): CustomPanel[] {
  return readCustomPanels(readString(CUSTOM_PANELS_KEY));
}

export function saveCustomPanels(panels: readonly CustomPanel[]) {
  if (panels.length === 0) removeItem(CUSTOM_PANELS_KEY);
  else writeJson(CUSTOM_PANELS_KEY, { version: PANELS_VERSION, panels });
}

const overlaps = (a: CellBox, b: CellBox) => a.col < b.col + b.cols && b.col < a.col + a.cols && a.row < b.row + b.rows && b.row < a.row + a.rows;

function firstFit(taken: readonly CellBox[], size: PanelSize, columns: number): CellBox {
  const { cols, rows } = CELLS[size];
  for (let row = 0; ; row += 1) {
    for (let col = 0; col + cols <= Math.max(columns, cols); col += 1) {
      const box = { col, row, cols, rows };
      if (!taken.some((other) => overlaps(box, other))) return box;
    }
  }
}

export function flowPanelItems(items: readonly Pick<PanelItem, "widget" | "size">[], columns = GRID_COLUMNS): PanelItem[] {
  const taken: CellBox[] = [];
  return items.map((item) => {
    const box = firstFit(taken, item.size, columns);
    taken.push(box);
    return placed(item.widget, item.size, box.col, box.row);
  });
}

const crossesPage = (col: number, cols: number, page: number) => cols <= page && Math.floor(col / page) !== Math.floor((col + cols - 1) / page);

export function flowStrip(items: readonly Pick<PanelItem, "widget" | "size">[], rows: number, page = Infinity): PanelItem[] {
  const taken: CellBox[] = [];
  return items.map((item) => {
    const { cols, rows: tall } = CELLS[item.size];
    for (let col = 0; ; col += 1) {
      for (let row = 0; row + tall <= Math.max(rows, tall); row += 1) {
        const box = { col, row, cols, rows: tall };
        if (crossesPage(col, cols, page) || taken.some((other) => overlaps(box, other))) continue;
        taken.push(box);
        return placed(item.widget, item.size, col, row);
      }
    }
  });
}

export function gridRows(items: readonly PanelItem[]): number {
  return items.reduce((rows, item) => {
    const box = cellBox(item);
    return Math.max(rows, box.row + box.rows);
  }, 0);
}

export function defaultWidgetSize(sizes: readonly PanelSize[]): PanelSize | null {
  return sizes.includes("m") ? "m" : (sizes[0] ?? null);
}

const reflow = (panel: CustomPanel, items: readonly PanelItem[]): CustomPanel =>
  panel.mode === "free" ? { ...panel, items: [...items] } : { ...panel, items: flowPanelItems(items) };

export const FREE_WIDTH_UNITS = GRID_COLUMNS * STEP - 1;
export const freeBottom = (items: readonly PanelItem[]) => items.reduce((bottom, item) => Math.max(bottom, item.y + item.h + 1), 0);
export const freeHeightPx = (items: readonly PanelItem[]) => Math.max(0, freeBottom(items) - 1) * GRID_UNIT_PX;
export const freeRightPx = (items: readonly PanelItem[]) => items.reduce((right, item) => Math.max(right, (item.x + item.w) * GRID_UNIT_PX), 0);
const minBox = (size: PanelSize) => placed("", size, 0, 0);
export const freeLeastPx = (size: PanelSize) => {
  const box = minBox(size);
  return { width: box.w * GRID_UNIT_PX, height: box.h * GRID_UNIT_PX };
};
const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), Math.max(low, high));

export function addPanelItem(panel: CustomPanel, widget: string, size: PanelSize): CustomPanel {
  if (panel.items.length >= MAX_ITEMS || panel.items.some((item) => item.widget === widget)) return panel;
  const item = placed(widget, size, 0, 0);
  return reflow(panel, [...panel.items, panel.mode === "free" ? { ...item, y: freeBottom(panel.items) } : item]);
}

export function resizePanelItem(panel: CustomPanel, widget: string, size: PanelSize): CustomPanel {
  if (!panel.items.some((item) => item.widget === widget && item.size !== size)) return panel;
  return reflow(
    panel,
    panel.items.map((item) => {
      if (item.widget !== widget) return item;
      const box = minBox(size);
      return { ...item, size, w: box.w, h: box.h, x: clamp(item.x, 0, FREE_WIDTH_UNITS - box.w) };
    }),
  );
}

export function removePanelItem(panel: CustomPanel, widget: string): CustomPanel {
  return reflow(panel, panel.items.filter((item) => item.widget !== widget));
}

export function reorderPanelItem(panel: CustomPanel, widget: string, before: string | null): CustomPanel {
  const moving = panel.items.find((item) => item.widget === widget);
  if (!moving || before === widget) return panel;
  const rest = panel.items.filter((item) => item !== moving);
  const at = before === null ? rest.length : rest.findIndex((item) => item.widget === before);
  if (at < 0) return panel;
  return reflow(panel, [...rest.slice(0, at), moving, ...rest.slice(at)]);
}

export function nextPanelSize(sizes: readonly PanelSize[], current: PanelSize): PanelSize | null {
  const order = PANEL_SIZES.filter((size) => sizes.includes(size));
  if (order.length < 2) return null;
  return order[(order.indexOf(current) + 1) % order.length] ?? null;
}

const touches = (a: PanelItem, b: PanelItem) => a.x < b.x + b.w + 1 && b.x < a.x + a.w + 1 && a.y < b.y + b.h + 1 && b.y < a.y + a.h + 1;

function pushedAway(items: readonly PanelItem[], widget: string, sideways = false): PanelItem[] {
  const placed = items.map((item) => ({ ...item }));
  const queue = placed.filter((item) => item.widget === widget);
  for (let guard = placed.length * placed.length; queue.length > 0 && guard > 0; guard -= 1) {
    const blocker = queue.shift();
    if (!blocker) break;
    for (const other of placed) {
      if (other === blocker || other.widget === widget || !touches(blocker, other)) continue;
      if (sideways) other.x = blocker.x + blocker.w + 1;
      else other.y = blocker.y + blocker.h + 1;
      queue.push(other);
    }
  }
  return placed.map((item, index) => (item.x === items[index].x && item.y === items[index].y ? items[index] : item));
}

export function placeFreeItem(panel: CustomPanel, widget: string, x: number, y: number, widthUnits = FREE_WIDTH_UNITS, heightUnits = Infinity): CustomPanel {
  const item = panel.items.find((candidate) => candidate.widget === widget);
  if (!item || panel.mode !== "free") return panel;
  const next = { ...item, x: clamp(Math.round(x), 0, widthUnits - item.w), y: clamp(Math.round(y), 0, heightUnits - item.h) };
  if (next.x === item.x && next.y === item.y && panel.items[panel.items.length - 1] === item) return panel;
  return { ...panel, items: pushedAway([...panel.items.filter((candidate) => candidate !== item), next], widget, heightUnits !== Infinity) };
}

export function stretchFreeItem(panel: CustomPanel, widget: string, w: number, h: number, widthUnits = FREE_WIDTH_UNITS, heightUnits = Infinity): CustomPanel {
  const item = panel.items.find((candidate) => candidate.widget === widget);
  if (!item || panel.mode !== "free") return panel;
  const least = minBox(item.size);
  const next = { ...item, w: clamp(Math.round(w), least.w, widthUnits - item.x), h: clamp(Math.round(h), least.h, heightUnits - item.y) };
  if (next.w === item.w && next.h === item.h) return panel;
  return { ...panel, items: pushedAway(panel.items.map((candidate) => (candidate === item ? next : candidate)), widget, heightUnits !== Infinity) };
}

export type PanelBox = { left: number; top: number; width: number; height: number };

export function itemBoxPx(panel: CustomPanel, item: PanelItem): PanelBox {
  if (panel.mode === "free") return { left: item.x * GRID_UNIT_PX, top: item.y * GRID_UNIT_PX, width: item.w * GRID_UNIT_PX, height: item.h * GRID_UNIT_PX };
  const box = cellBox(item);
  const step = GRID_CELL_PX + GRID_GAP_PX;
  return { left: box.col * step, top: box.row * step, width: cellsToPx(box.cols), height: cellsToPx(box.rows) };
}

export function boardHeightPx(panel: CustomPanel): number {
  return panel.mode === "free" ? Math.max(freeHeightPx(panel.items), GRID_CELL_PX) : cellsToPx(Math.max(1, gridRows(panel.items)));
}

export function layoutStrip(panel: CustomPanel, rows: number, page = Infinity): CustomPanel {
  return panel.mode === "grid" ? { ...panel, items: flowStrip(panel.items, rows, page) } : panel;
}

export function stripRightPx(panel: CustomPanel): number {
  if (panel.mode === "free") return freeRightPx(panel.items);
  const cols = panel.items.reduce((right, item) => Math.max(right, cellBox(item).col + cellBox(item).cols), 0);
  return cols > 0 ? cellsToPx(cols) : 0;
}

export function stripInsertIndexAt(panel: CustomPanel, x: number, y: number, skip: string | null): number {
  const rest = panel.items.filter((item) => item.widget !== skip);
  for (let index = 0; index < rest.length; index += 1) {
    const box = itemBoxPx(panel, rest[index]);
    const inColumn = x >= box.left && x < box.left + box.width;
    if (inColumn && y >= box.top && y < box.top + box.height) return x < box.left + box.width / 2 ? index : index + 1;
    if (x < box.left || (inColumn && y < box.top)) return index;
  }
  return rest.length;
}

export function setPanelMode(panel: CustomPanel, mode: PanelMode, byColumn = false): CustomPanel {
  if (panel.mode === mode) return panel;
  if (mode === "free") return { ...panel, mode };
  const ordered = [...panel.items].sort((a, b) => (byColumn ? a.x - b.x || a.y - b.y : a.y - b.y || a.x - b.x));
  return { ...panel, mode, items: flowPanelItems(ordered) };
}

export function insertIndexAt(panel: CustomPanel, x: number, y: number, skip: string | null): number {
  const rest = panel.items.filter((item) => item.widget !== skip);
  for (let index = 0; index < rest.length; index += 1) {
    const box = itemBoxPx(panel, rest[index]);
    const inRow = y >= box.top && y < box.top + box.height;
    if (inRow && x >= box.left && x < box.left + box.width) return x < box.left + box.width / 2 ? index : index + 1;
    if (y < box.top || (inRow && x < box.left)) return index;
  }
  return rest.length;
}

export function movePanelItemTo(panel: CustomPanel, widget: string, index: number): CustomPanel {
  const moving = panel.items.find((item) => item.widget === widget);
  if (!moving) return panel;
  const rest = panel.items.filter((item) => item !== moving);
  const at = clamp(Math.round(index), 0, rest.length);
  if (panel.items[at] === moving) return panel;
  return reflow(panel, [...rest.slice(0, at), moving, ...rest.slice(at)]);
}

export function dropNewPanelItem(panel: CustomPanel, widget: string, size: PanelSize, x: number, y: number, widthUnits = FREE_WIDTH_UNITS): CustomPanel {
  const added = addPanelItem(panel, widget, size);
  if (added === panel) return panel;
  if (panel.mode !== "grid") {
    const box = minBox(size);
    return placeFreeItem(added, widget, x / GRID_UNIT_PX - box.w / 2, y / GRID_UNIT_PX - box.h / 2, widthUnits);
  }
  return movePanelItemTo(added, widget, insertIndexAt(panel, x, y, null));
}

export const FUYU_PANEL_ID = "fuyu";
export const FUYU_PAGE_ID = `${CUSTOM_PANEL_PAGE_PREFIX}${FUYU_PANEL_ID}`;

export const DEFAULT_FUYU_ITEMS: readonly (readonly [string, PanelSize])[] = [
  ["today", "l"],
  ["system-status", "s"],
  ["battery", "s"],
  ["countdown", "s"],
  ["network", "s"],
  ["pomodoro", "s"],
  ["streak", "s"],
  ["year-progress", "s"],
  ["water", "s"],
  ["music", "m"],
  ["next-meeting", "m"],
  ["lyrics", "w"],
  ["todos", "m"],
  ["focus-stats", "s"],
  ["unread", "s"],
  ["month-calendar", "l"],
  ["note", "m"],
  ["habits", "m"],
  ["world-clock", "s"],
  ["session-count", "m"],
  ["sun", "s"],
  ["translate", "m"],
  ["clipboard-recent", "m"],
  ["shelf", "s"],
  ["screenshot-recent", "s"],
  ["launcher", "s"],
  ["levels", "s"],
  ["stopwatch", "s"],
  ["timer", "s"],
];

let defaultFuyu: CustomPanel | null = null;

export function defaultFuyuPanel(): CustomPanel {
  defaultFuyu ??= DEFAULT_FUYU_ITEMS.reduce<CustomPanel>((panel, [widget, size]) => addPanelItem(panel, widget, size), { id: FUYU_PANEL_ID, name: "", icon: PANEL_ICONS[0], mode: "grid", items: [] });
  return defaultFuyu;
}

export function fuyuPanel(panels: readonly CustomPanel[]): CustomPanel {
  const found = panels.find((panel) => panel.id === FUYU_PANEL_ID) ?? panels[0];
  return found ? { ...found, id: FUYU_PANEL_ID } : defaultFuyuPanel();
}

export function fuyuPanels(panel: CustomPanel): CustomPanel[] {
  return [{ ...panel, id: FUYU_PANEL_ID }];
}
