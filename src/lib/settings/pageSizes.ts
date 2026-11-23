import { clamp } from "../../utils/number.ts";
import { MAX_MAX_PANEL_HEIGHT, MAX_PANEL_WIDTH, MIN_PANEL_WIDTH } from "./settingsLimits.ts";
import type { PanelPageSize } from "./types";

export const MIN_PAGE_PANEL_HEIGHT = 240;
const MAX_PAGES = 64;
const MAX_PAGE_ID_LENGTH = 120;

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeSize(value: unknown): PanelPageSize | null {
  if (typeof value !== "object" || value === null) return null;
  const { width, height } = value as Record<string, unknown>;
  if (!finite(width) || !finite(height)) return null;
  return {
    width: clamp(Math.round(width), MIN_PANEL_WIDTH, MAX_PANEL_WIDTH),
    height: clamp(Math.round(height), MIN_PAGE_PANEL_HEIGHT, MAX_MAX_PANEL_HEIGHT),
  };
}

export function normalizePageSizes(value: unknown): Record<string, PanelPageSize> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const entries = Object.entries(value)
    .filter(([page]) => page !== "" && page.length <= MAX_PAGE_ID_LENGTH)
    .flatMap(([page, size]) => {
      const normalized = normalizeSize(size);
      return normalized ? [[page, normalized] as const] : [];
    })
    .slice(0, MAX_PAGES);
  return Object.fromEntries(entries);
}

export function pagePanelSize(sizes: Record<string, PanelPageSize>, page: string, fallback: PanelPageSize): PanelPageSize {
  return Object.prototype.hasOwnProperty.call(sizes, page) ? sizes[page] : fallback;
}

export function widestPanelWidth(sizes: Record<string, PanelPageSize>, fallbackWidth: number): number {
  return Object.values(sizes).reduce((widest, size) => Math.max(widest, size.width), fallbackWidth);
}

export function withPageSize(sizes: Record<string, PanelPageSize>, page: string, size: PanelPageSize): Record<string, PanelPageSize> {
  const rest = Object.entries(sizes).filter(([key]) => key !== page).slice(-(MAX_PAGES - 1));
  return Object.fromEntries([...rest, [page, size]]);
}
