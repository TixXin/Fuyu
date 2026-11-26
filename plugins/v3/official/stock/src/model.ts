export type Market = "cn" | "hk" | "us" | "other";
export type ColorScheme = "redUp" | "greenUp";
export type BarMode = "rotate" | "fixed";
export type SourceId = "eastmoney" | "tencent";

export interface StockItem {
  id: string;
  code: string;
  name: string;
  kind: string;
}

export interface StockSettings {
  stocks: StockItem[];
  refreshSeconds: number;
  colorScheme: ColorScheme;
  showInBar: boolean;
  barMode: BarMode;
  barSeconds: number;
  barPrice: boolean;
  refreshOnOpen: boolean;
}

export interface Quote {
  id: string;
  price: number | null;
  change: number | null;
  percent: number | null;
  time: number | null;
}

export type FeedStatus = "idle" | "live" | "closed" | "holiday" | "offline";

export interface StockState {
  settings: StockSettings;
  quotes: Record<string, Quote>;
  status: FeedStatus;
  source: SourceId | null;
  updatedAt: number | null;
  nextAt: number | null;
  loading: boolean;
  at: number;
}

export type AddResult = { ok: true; stock: StockItem } | { ok: false; reason: "invalid" | "duplicate" | "full" };

export const REFRESH_OPTIONS = [15, 30, 60, 120, 300] as const;
export const BAR_SECONDS_OPTIONS = [3, 5, 8, 10] as const;
export const MAX_STOCKS = 20;
export const SOFT_REFRESH_MS = 10_000;

export const DEFAULT_SETTINGS: StockSettings = {
  stocks: [],
  refreshSeconds: 30,
  colorScheme: "redUp",
  showInBar: true,
  barMode: "rotate",
  barSeconds: 5,
  barPrice: false,
  refreshOnOpen: true,
};

export const METHODS = {
  getState: "getState",
  setSettings: "setSettings",
  search: "search",
  addStock: "addStock",
  removeStock: "removeStock",
  moveStock: "moveStock",
  refresh: "refresh",
} as const;

export const TOPICS = { state: "state" } as const;

const QUOTE_ID = /^\d{1,3}\.[A-Za-z0-9_.-]{1,16}$/;

export function marketOf(id: string): Market {
  const prefix = id.slice(0, id.indexOf("."));
  if (prefix === "0" || prefix === "1") return "cn";
  if (prefix === "116" || prefix === "124" || prefix === "128") return "hk";
  if (prefix === "105" || prefix === "106" || prefix === "107") return "us";
  return "other";
}

export function isQuoteId(value: unknown): value is string {
  return typeof value === "string" && QUOTE_ID.test(value);
}

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function normalizeStock(raw: unknown): StockItem | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  if (!isQuoteId(src.id)) return null;
  const code = clip(src.code, 16) || src.id.slice(src.id.indexOf(".") + 1);
  return { id: src.id, code, name: clip(src.name, 32) || code, kind: clip(src.kind, 16) };
}

function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeSettings(raw: unknown, base: StockSettings = DEFAULT_SETTINGS): StockSettings {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  let stocks = base.stocks;
  if (Array.isArray(src.stocks)) {
    const seen = new Set<string>();
    stocks = [];
    for (const item of src.stocks) {
      const stock = normalizeStock(item);
      if (!stock || seen.has(stock.id) || stocks.length >= MAX_STOCKS) continue;
      seen.add(stock.id);
      stocks.push(stock);
    }
  }
  return {
    stocks,
    refreshSeconds: pick(src.refreshSeconds, REFRESH_OPTIONS, base.refreshSeconds as (typeof REFRESH_OPTIONS)[number]),
    colorScheme: pick(src.colorScheme, ["redUp", "greenUp"] as const, base.colorScheme),
    showInBar: flag(src.showInBar, base.showInBar),
    barMode: pick(src.barMode, ["rotate", "fixed"] as const, base.barMode),
    barSeconds: pick(src.barSeconds, BAR_SECONDS_OPTIONS, base.barSeconds as (typeof BAR_SECONDS_OPTIONS)[number]),
    barPrice: flag(src.barPrice, base.barPrice),
    refreshOnOpen: flag(src.refreshOnOpen, base.refreshOnOpen),
  };
}

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export type Trend = "up" | "down" | "flat" | "none";

export function trendOf(quote: Quote | undefined): Trend {
  if (!quote || quote.price === null || quote.change === null) return "none";
  if (quote.change > 0) return "up";
  if (quote.change < 0) return "down";
  return "flat";
}

export function decimalsFor(price: number): number {
  return price >= 1 ? 2 : 3;
}

export function formatPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "--";
  return value.toFixed(decimalsFor(Math.abs(value)));
}

export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "--";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

export function formatChange(value: number | null, price: number | null): string {
  if (value === null || !Number.isFinite(value)) return "--";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(decimalsFor(Math.abs(price ?? value)))}`;
}

export function cnExchange(id: string): "sh" | "sz" | "bj" {
  if (id.startsWith("1.")) return "sh";
  const code = id.slice(2);
  return /^(8|4|92)/.test(code) ? "bj" : "sz";
}

export function displayCode(stock: StockItem): string {
  const market = marketOf(stock.id);
  if (market === "cn") return `${cnExchange(stock.id).toUpperCase()}${stock.code}`;
  if (market === "hk") return `HK${stock.code}`;
  return stock.code.replace(/_/g, ".");
}
