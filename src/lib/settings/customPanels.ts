import { readString, removeItem, writeJson } from "../storage.ts";

export const CUSTOM_PANELS_KEY = "fuyu-custom-panels";
export const CUSTOM_PANEL_PAGE_PREFIX = "panel:";
const PANELS_VERSION = 1;

export const GRID_COLUMNS = 4;
export const GRID_VISIBLE_ROWS = 4;
export const GRID_CELL_PX = 120;
export const GRID_GAP_PX = 8;
export const GRID_UNIT_PX = 8;
const STEP = (GRID_CELL_PX + GRID_GAP_PX) / GRID_UNIT_PX;
const MAX_PANELS = 24;
const MAX_ITEMS = 48;
const MAX_NAME = 40;

export const PANEL_SIZES = ["s", "m", "l", "w"] as const;
export type PanelSize = (typeof PANEL_SIZES)[number];
export type PanelMode = "grid" | "free";

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
  return { col: Math.min(Math.max(0, Math.round(item.x / STEP)), GRID_COLUMNS - cols), row: Math.max(0, Math.round(item.y / STEP)), cols, rows };
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

export function cleanPanelName(name: unknown): string {
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

export function settleGrid(items: readonly PanelItem[], fixed: number | null = null): PanelItem[] {
  const boxes = items.map(cellBox);
  const order = items.map((_, index) => index).filter((index) => index !== fixed).sort((a, b) => boxes[a].row - boxes[b].row || boxes[a].col - boxes[b].col || a - b);
  const done: CellBox[] = fixed === null || !boxes[fixed] ? [] : [boxes[fixed]];
  for (const index of order) {
    const box = boxes[index];
    while (done.some((other) => overlaps(box, other))) box.row += 1;
    done.push(box);
  }
  return items.map((item, index) => placed(item.widget, item.size, boxes[index].col, boxes[index].row));
}

export function gridRows(items: readonly PanelItem[]): number {
  return items.reduce((rows, item) => {
    const box = cellBox(item);
    return Math.max(rows, box.row + box.rows);
  }, 0);
}

export function freeCell(items: readonly PanelItem[], size: PanelSize): { col: number; row: number } {
  const { cols, rows } = CELLS[size];
  const boxes = items.map(cellBox);
  for (let row = 0; ; row += 1) {
    for (let col = 0; col + cols <= GRID_COLUMNS; col += 1) {
      const box = { col, row, cols, rows };
      if (!boxes.some((other) => overlaps(box, other))) return { col, row };
    }
  }
}

export function addPanelItem(panel: CustomPanel, widget: string, size: PanelSize): CustomPanel {
  if (panel.items.length >= MAX_ITEMS) return panel;
  const { col, row } = freeCell(panel.items, size);
  return { ...panel, items: [...panel.items, placed(widget, size, col, row)] };
}

export function movePanelItem(panel: CustomPanel, index: number, col: number, row: number): CustomPanel {
  const item = panel.items[index];
  if (!item) return panel;
  const { cols } = CELLS[item.size];
  const target = placed(item.widget, item.size, Math.min(Math.max(0, Math.round(col)), GRID_COLUMNS - cols), Math.max(0, Math.round(row)));
  const items = panel.items.map((other, at) => (at === index ? target : other));
  return { ...panel, items: settleGrid(items, index) };
}

export function resizePanelItem(panel: CustomPanel, index: number, size: PanelSize): CustomPanel {
  const item = panel.items[index];
  if (!item || item.size === size) return panel;
  const box = cellBox(item);
  const items = panel.items.map((other, at) => (at === index ? placed(item.widget, size, Math.min(box.col, GRID_COLUMNS - CELLS[size].cols), box.row) : other));
  return { ...panel, items: settleGrid(items, index) };
}

export function removePanelItem(panel: CustomPanel, index: number): CustomPanel {
  return { ...panel, items: panel.items.filter((_, at) => at !== index) };
}

export function createPanel(panels: readonly CustomPanel[], id: string, name: string, icon: PanelIcon): CustomPanel[] {
  if (panels.length >= MAX_PANELS || panels.some((panel) => panel.id === id)) return [...panels];
  return [...panels, { id, name: cleanPanelName(name), icon, mode: "grid", items: [] }];
}

export function updatePanel(panels: readonly CustomPanel[], id: string, change: (panel: CustomPanel) => CustomPanel): CustomPanel[] {
  return panels.map((panel) => (panel.id === id ? change(panel) : panel));
}

export function removePanel(panels: readonly CustomPanel[], id: string): CustomPanel[] {
  return panels.filter((panel) => panel.id !== id);
}

export function newPanelId(now: number, random: number): string {
  return `${now.toString(36)}${Math.floor(random * 36 ** 4).toString(36).padStart(4, "0")}`;
}
