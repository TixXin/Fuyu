import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Context, PluginSetupState } from "@fuyu/plugin-base";
import { isSessionTime, looksLikeHoliday, nextOpenAt, watchedMarkets } from "./market.ts";
import {
  MAX_STOCKS,
  METHODS,
  SAMPLE_STOCKS,
  SOFT_REFRESH_MS,
  TOPICS,
  initialSettings,
  isQuoteId,
  marketOf,
  moveItem,
  normalizeSettings,
  normalizeStock,
  type AddResult,
  type FeedStatus,
  type Market,
  type Quote,
  type SourceId,
  type StockSettings,
  type StockState,
} from "./model.ts";
import { fetchQuotes, searchStocks, type HttpFetch } from "./sources.ts";
import { SETUP_HINT } from "./text.ts";

export const name = "@fuyu/stock";
export const inject = { clients: null, commands: null, http: { required: false }, settings: { required: false } };

const CONFIG_FILE = "config.json";
const CACHE_FILE = "cache.json";
const BACKOFF_SECONDS = [60, 120, 300, 600];
const HOLIDAY_RECHECK_MS = 30 * 60_000;
const MAX_SLEEP_MS = 6 * 60 * 60_000;

type SetupApi = { settings?: { setup?: (state: PluginSetupState) => Promise<void> | void } };
type HttpApi = { http?: { fetch?: HttpFetch } };

function readJson(file: string): unknown {
  try {
    return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  } catch {
    return null;
  }
}

function writeJson(dir: string, file: string, value: unknown): void {
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, file), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  } catch {
    return;
  }
}

function loadCache(raw: unknown): Map<string, Quote> {
  const quotes = new Map<string, Quote>();
  const list = raw && typeof raw === "object" ? (raw as { quotes?: unknown }).quotes : null;
  if (!Array.isArray(list)) return quotes;
  for (const item of list) {
    if (!item || typeof item !== "object" || !isQuoteId((item as Quote).id)) continue;
    const quote = item as Quote;
    const n = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
    quotes.set(quote.id, { id: quote.id, price: n(quote.price), change: n(quote.change), percent: n(quote.percent), time: n(quote.time) });
  }
  return quotes;
}

function reportSetup(ctx: Context, state: PluginSetupState): void {
  try {
    void Promise.resolve((ctx as unknown as SetupApi).settings?.setup?.(state)).catch(() => {});
  } catch {
    return;
  }
}

export function apply(ctx: Context) {
  const fetcher: HttpFetch = (input, init) => {
    const httpFetch = (ctx as unknown as HttpApi).http?.fetch;
    return httpFetch ? httpFetch(input, init) : fetch(input, init);
  };

  let settings: StockSettings = initialSettings(readJson(join(ctx.dataDir, CONFIG_FILE)));
  const quotes = loadCache(readJson(join(ctx.dataDir, CACHE_FILE)));
  let source: SourceId | null = null;
  let updatedAt: number | null = null;
  let failures = 0;
  let loading = false;
  let nextAt: number | null = null;
  let running: Promise<StockState> | null = null;
  let stopTimer: (() => Promise<void>) | null = null;
  let disposed = false;
  (ctx as unknown as { on?: (event: string, fn: () => void) => void }).on?.("dispose", () => {
    disposed = true;
  });

  const quotesOf = (market: Market) => settings.stocks.filter((stock) => marketOf(stock.id) === market).map((stock) => quotes.get(stock.id));

  function feed(at: number): { status: FeedStatus; delay: number | null } {
    if (settings.stocks.length === 0) return { status: "idle", delay: null };
    const markets = watchedMarkets(settings.stocks);
    const inSession = [...markets].filter((market) => market !== "other" && isSessionTime(market, at));
    const active =
      inSession.some((market) => !looksLikeHoliday(market, at, quotesOf(market))) ||
      (markets.has("other") && (["cn", "hk", "us"] as const).some((market) => isSessionTime(market, at)));
    if (failures > 0 && (active || quotes.size === 0)) {
      return { status: "offline", delay: BACKOFF_SECONDS[Math.min(failures, BACKOFF_SECONDS.length) - 1] * 1000 };
    }
    if (active) return { status: "live", delay: settings.refreshSeconds * 1000 };
    if (inSession.length > 0) return { status: "holiday", delay: HOLIDAY_RECHECK_MS };
    const open = nextOpenAt(markets, at);
    const delay = open === null ? MAX_SLEEP_MS : Math.min(MAX_SLEEP_MS, Math.max(60_000, open - at + 5_000));
    return { status: "closed", delay };
  }

  const snapshot = (): StockState => {
    const at = Date.now();
    const shown: Record<string, Quote> = {};
    for (const stock of settings.stocks) {
      const quote = quotes.get(stock.id);
      if (quote) shown[stock.id] = quote;
    }
    return { settings, quotes: shown, status: feed(at).status, source, updatedAt, nextAt, loading, at };
  };

  const publish = () => {
    if (disposed) return;
    try {
      ctx.clients.publish(TOPICS.state, snapshot());
    } catch {
      return;
    }
  };

  const persist = () => {
    writeJson(ctx.dataDir, CONFIG_FILE, settings);
    reportSetup(ctx, { needed: settings.stocks.length === 0, hint: SETUP_HINT });
  };

  function schedule() {
    if (stopTimer) {
      void stopTimer();
      stopTimer = null;
    }
    nextAt = null;
    if (disposed) return;
    const { delay } = feed(Date.now());
    if (delay === null) return;
    nextAt = Date.now() + delay;
    try {
      stopTimer = ctx.setTimeout(() => {
        stopTimer = null;
        void refresh();
      }, delay);
    } catch {
      stopTimer = null;
    }
  }

  async function runRefresh(): Promise<StockState> {
    const ids = settings.stocks.map((stock) => stock.id);
    if (ids.length === 0) {
      schedule();
      publish();
      return snapshot();
    }
    loading = true;
    publish();
    try {
      const result = await fetchQuotes(fetcher, ids);
      for (const quote of result.quotes) quotes.set(quote.id, quote);
      for (const id of [...quotes.keys()]) if (!ids.includes(id)) quotes.delete(id);
      source = result.source;
      updatedAt = Date.now();
      failures = 0;
      writeJson(ctx.dataDir, CACHE_FILE, { quotes: [...quotes.values()] });
    } catch {
      failures += 1;
    } finally {
      loading = false;
    }
    schedule();
    publish();
    return snapshot();
  }

  function refresh(soft = false): Promise<StockState> {
    if (running) return running;
    if (soft && updatedAt !== null && Date.now() - updatedAt < SOFT_REFRESH_MS) return Promise.resolve(snapshot());
    running = runRefresh().finally(() => {
      running = null;
    });
    return running;
  }

  reportSetup(ctx, { needed: settings.stocks.length === 0, hint: SETUP_HINT });
  void refresh();

  ctx.clients.handle(METHODS.getState, async () => snapshot());

  ctx.clients.handle(METHODS.setSettings, async (params?: unknown) => {
    const patch = params && typeof params === "object" ? { ...(params as Record<string, unknown>) } : {};
    delete patch.stocks;
    const before = settings.refreshSeconds;
    settings = normalizeSettings({ ...settings, ...patch }, settings);
    persist();
    if (settings.refreshSeconds !== before) schedule();
    publish();
    return snapshot();
  });

  ctx.clients.handle(METHODS.search, async (params?: { keyword?: unknown }) => {
    const keyword = typeof params?.keyword === "string" ? params.keyword : "";
    return searchStocks(fetcher, keyword);
  });

  ctx.clients.handle(METHODS.addStock, async (params?: { stock?: unknown }): Promise<AddResult> => {
    const stock = normalizeStock(params?.stock);
    if (!stock) return { ok: false, reason: "invalid" };
    if (settings.stocks.some((item) => item.id === stock.id)) return { ok: false, reason: "duplicate" };
    if (settings.stocks.length >= MAX_STOCKS) return { ok: false, reason: "full" };
    settings = { ...settings, stocks: [...settings.stocks, stock], sample: false };
    persist();
    void refresh();
    return { ok: true, stock };
  });

  ctx.clients.handle(METHODS.removeStock, async (params?: { id?: unknown }) => {
    settings = { ...settings, stocks: settings.stocks.filter((stock) => stock.id !== params?.id), sample: false };
    quotes.delete(String(params?.id));
    persist();
    schedule();
    publish();
    return snapshot();
  });

  ctx.clients.handle(METHODS.moveStock, async (params?: { from?: unknown; to?: unknown }) => {
    const from = Number(params?.from);
    const to = Number(params?.to);
    if (Number.isInteger(from) && Number.isInteger(to)) {
      settings = { ...settings, stocks: moveItem(settings.stocks, from, to), sample: false };
      persist();
      publish();
    }
    return snapshot();
  });

  ctx.clients.handle(METHODS.restoreSample, async () => {
    settings = { ...settings, stocks: SAMPLE_STOCKS.map((stock) => ({ ...stock })), sample: true };
    persist();
    return refresh();
  });

  ctx.clients.handle(METHODS.refresh, async (params?: { soft?: unknown }) => refresh(params?.soft === true));

  ctx.commands.register("refresh", () => refresh(), {
    title: { "zh-CN": "立即刷新行情", en: "Refresh quotes now" },
  });
}
