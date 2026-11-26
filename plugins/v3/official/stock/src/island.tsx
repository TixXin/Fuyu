import type { Context } from "@fuyu/plugin-base";
import { useEffect, useId, useRef, useState } from "react";
import { FocusChart, MiniSpark } from "./chart.tsx";
import { ArrowIcon, ChevronIcon, RefreshIcon, SettingsIcon, StockIcon } from "./icons.tsx";
import {
  METHODS,
  displayCode,
  formatChange,
  formatPercent,
  formatPrice,
  marketBadge,
  trendOf,
  type ColorScheme,
  type Quote,
  type StockItem,
  type StockState,
  type TrendSeries,
} from "./model.ts";
import { PAGE_TITLE, clock, quoteClock, text } from "./text.ts";
import { useStocks } from "./useStocks.ts";
import "./styles.css";

const PAGE_ID = "@fuyu/stock";

type SettingsOpener = { settings?: { open?: () => unknown } };

function settingsOpener(ctx: Context): (() => unknown) | null {
  const holder = (ctx as unknown as SettingsOpener).settings;
  const open = holder?.open;
  return typeof open === "function" ? () => open.call(holder) : null;
}

function schemeClass(scheme: ColorScheme): string {
  return scheme === "greenUp" ? " is-green-up" : "";
}

function summaryCounts(stocks: readonly StockItem[], quotes: Record<string, Quote>): { up: number; down: number } {
  let up = 0;
  let down = 0;
  for (const stock of stocks) {
    const trend = trendOf(quotes[stock.id]);
    if (trend === "up") up += 1;
    else if (trend === "down") down += 1;
  }
  return { up, down };
}

function WatchRow({
  stock,
  quote,
  series,
  selected,
  now,
  onSelect,
}: {
  stock: StockItem;
  quote: Quote | undefined;
  series: TrendSeries | undefined;
  selected: boolean;
  now: number;
  onSelect: () => void;
}) {
  const trend = trendOf(quote);
  const tip = quote?.time ? `${stock.name} · ${text.quoteTime(quoteClock(quote.time, now))}` : stock.name;
  const hasQuote = Boolean(quote && quote.price !== null);
  return (
    <li>
      <button
        type="button"
        className={selected ? `fuyu-stock__row is-${trend} is-selected` : `fuyu-stock__row is-${trend}`}
        title={tip}
        aria-pressed={selected}
        onClick={onSelect}
      >
        <span className="fuyu-stock__accent" aria-hidden="true" />
        <span className="fuyu-stock__who">
          <span className="fuyu-stock__name">{stock.name}</span>
          <span className="fuyu-stock__code">{`${marketBadge(stock)} ${stock.code.replace(/_/g, ".")}`}</span>
        </span>
        <span className="fuyu-stock__spark-cell">
          <MiniSpark series={series} trend={trend} />
        </span>
        {hasQuote && quote ? (
          <>
            <span className="fuyu-stock__num">{formatPrice(quote.price)}</span>
            <span className="fuyu-stock__pill">{formatPercent(quote.percent)}</span>
          </>
        ) : (
          <span className="fuyu-stock__none">{text.noQuote}</span>
        )}
      </button>
    </li>
  );
}

function FocusCard({
  stock,
  quote,
  series,
  state,
  gradId,
}: {
  stock: StockItem;
  quote: Quote | undefined;
  series: TrendSeries | undefined;
  state: StockState;
  gradId: string;
}) {
  const trend = trendOf(quote);
  const hasQuote = Boolean(quote && quote.price !== null);
  const statusLabel = text.status[state.status];
  const updated = state.updatedAt ? clock(state.updatedAt) : "";
  const preClose = quote?.preClose ?? series?.preClose ?? null;
  return (
    <div className={`fuyu-stock__focus is-${trend}`}>
      <div className="fuyu-stock__focus-head">
        <span className="fuyu-stock__focus-id">
          <strong className="fuyu-stock__focus-name">{stock.name}</strong>
          <span className="fuyu-stock__mkt">{marketBadge(stock)}</span>
          <span className="fuyu-stock__focus-code">{stock.code.replace(/_/g, ".")}</span>
        </span>
        <span className={`fuyu-stock__status is-${state.status}`}>
          <span className="fuyu-stock__dot" />
          <span className="fuyu-stock__status-text">{[statusLabel, updated].filter(Boolean).join(" · ")}</span>
        </span>
      </div>

      <div className="fuyu-stock__focus-price">
        <span className="fuyu-stock__hero-num">{hasQuote && quote ? formatPrice(quote.price) : "--"}</span>
        {hasQuote && quote && (
          <>
            <span className="fuyu-stock__hero-delta">{formatChange(quote.change, quote.price)}</span>
            <span className="fuyu-stock__hero-pill">{formatPercent(quote.percent)}</span>
          </>
        )}
      </div>

      <FocusChart series={series} quote={quote} trend={trend} gradId={gradId} />

      <div className="fuyu-stock__metrics">
        <span className="fuyu-stock__metric">
          <span className="fuyu-stock__metric-label">{text.open}</span>
          <span className="fuyu-stock__metric-val">{formatPrice(quote?.open ?? null)}</span>
        </span>
        <span className="fuyu-stock__metric">
          <span className="fuyu-stock__metric-label">{text.high}</span>
          <span className="fuyu-stock__metric-val">{formatPrice(quote?.high ?? null)}</span>
        </span>
        <span className="fuyu-stock__metric">
          <span className="fuyu-stock__metric-label">{text.low}</span>
          <span className="fuyu-stock__metric-val">{formatPrice(quote?.low ?? null)}</span>
        </span>
        <span className="fuyu-stock__metric">
          <span className="fuyu-stock__metric-label">{text.preClose}</span>
          <span className="fuyu-stock__metric-val">{formatPrice(preClose)}</span>
        </span>
      </div>
    </div>
  );
}

export default function apply(ctx: Context) {
  const openSettings = settingsOpener(ctx);

  function StockPage() {
    const { state, ready, error, invoke } = useStocks(ctx);
    const [selectedId, setSelectedId] = useState<string>("");
    const gradId = useId();
    const opened = useRef(false);
    const { settings } = state;

    const activeStock = settings.stocks.find((item) => item.id === selectedId) ?? settings.stocks[0] ?? null;

    useEffect(() => {
      if (!ready || opened.current) return;
      opened.current = true;
      if (settings.refreshOnOpen && settings.stocks.length > 0) invoke(METHODS.refresh, { soft: true });
    }, [ready, settings.refreshOnOpen, settings.stocks.length, invoke]);

    useEffect(() => {
      if (!ready || !activeStock) return;
      if (!state.trends?.[activeStock.id]) {
        invoke(METHODS.getTrend, { id: activeStock.id });
      }
    }, [ready, activeStock, state.trends, invoke]);

    if (!ready) return <div className="fuyu-stock" />;

    if (settings.stocks.length === 0 || !activeStock) {
      return (
        <div className="fuyu-stock">
          <div className="fuyu-stock__empty">
            <span className="fuyu-stock__empty-icon" aria-hidden="true">
              <StockIcon size={20} />
            </span>
            <p className="fuyu-stock__note">{openSettings ? text.noStocks : `${text.noStocks} ${text.noStocksHint}`}</p>
            <div className="fuyu-stock__empty-actions">
              {openSettings && (
                <button type="button" className="fuyu-stock__go" onClick={() => void openSettings()}>
                  {text.goSettings}
                </button>
              )}
              <button type="button" className="fuyu-stock__secondary" onClick={() => invoke(METHODS.restoreSample)}>
                {text.loadSample}
              </button>
            </div>
          </div>
        </div>
      );
    }

    const now = Date.now();
    const counts = summaryCounts(settings.stocks, state.quotes);
    return (
      <div className={`fuyu-stock${schemeClass(settings.colorScheme)}`}>
        <div className="fuyu-stock__layout">
          <FocusCard
            stock={activeStock}
            quote={state.quotes[activeStock.id]}
            series={state.trends?.[activeStock.id]}
            state={state}
            gradId={gradId}
          />
          <div className="fuyu-stock__panel">
            <div className="fuyu-stock__panel-head">
              <div className="fuyu-stock__panel-meta">
                {(counts.up > 0 || counts.down > 0) && (
                  <span className="fuyu-stock__tally">
                    {counts.up > 0 && <span className="fuyu-stock__tally-up">{`↑${counts.up}`}</span>}
                    {counts.down > 0 && <span className="fuyu-stock__tally-down">{`↓${counts.down}`}</span>}
                  </span>
                )}
                {settings.sample && openSettings && (
                  <button type="button" className="fuyu-stock__sample-pill" onClick={() => void openSettings()}>
                    <span>{`${text.sampleTag} · ${text.manage}`}</span>
                    <ChevronIcon size={11} />
                  </button>
                )}
              </div>
              <div className="fuyu-stock__actions">
                <button
                  type="button"
                  className="fuyu-stock__icon-btn"
                  disabled={state.loading}
                  title={state.loading ? text.refreshing : text.refresh}
                  aria-label={state.loading ? text.refreshing : text.refresh}
                  onClick={() => invoke(METHODS.refresh)}
                >
                  <RefreshIcon size={13} />
                </button>
                {openSettings && (
                  <button
                    type="button"
                    className="fuyu-stock__icon-btn"
                    title={text.settingsTip}
                    aria-label={text.settingsTip}
                    onClick={() => void openSettings()}
                  >
                    <SettingsIcon size={13} />
                  </button>
                )}
              </div>
            </div>
            <ul className="fuyu-stock__list">
              {settings.stocks.map((stock) => (
                <WatchRow
                  key={stock.id}
                  stock={stock}
                  quote={state.quotes[stock.id]}
                  series={state.trends?.[stock.id]}
                  selected={stock.id === activeStock.id}
                  now={now}
                  onSelect={() => setSelectedId(stock.id)}
                />
              ))}
            </ul>
          </div>
        </div>
        {error && <p className="fuyu-stock__note">{error}</p>}
      </div>
    );
  }

  function StockCollapsed() {
    const { state } = useStocks(ctx);
    const { settings } = state;
    const [index, setIndex] = useState(0);
    const count = settings.stocks.length;
    const rotate = settings.barMode === "rotate" && count > 1;

    useEffect(() => {
      if (!rotate) return;
      // eslint-disable-next-line no-restricted-globals
      const timer = setTimeout(() => setIndex((value) => (value + 1) % count), settings.barSeconds * 1000);
      return () => clearTimeout(timer);
    }, [rotate, count, index, settings.barSeconds]);

    if (!settings.showInBar || count === 0) return null;
    const stock = settings.stocks[rotate ? index % count : 0];
    const quote = state.quotes[stock.id];
    const trend = trendOf(quote);
    return (
      <span className={`fuyu-stock-chip is-${trend}${schemeClass(settings.colorScheme)}`} title={`${stock.name} ${displayCode(stock)}`}>
        <span className="fuyu-stock-chip__name">{stock.name}</span>
        {settings.barPrice && quote && quote.price !== null && <span className="fuyu-stock-chip__price">{formatPrice(quote.price)}</span>}
        {(trend === "up" || trend === "down") && <ArrowIcon direction={trend} size={11} />}
        <span className="fuyu-stock-chip__pct">{quote && quote.price !== null ? formatPercent(quote.percent) : "--"}</span>
      </span>
    );
  }

  ctx.slots.add("island.page/v1", { id: PAGE_ID, title: PAGE_TITLE, component: StockPage, icon: StockIcon });
  ctx.slots.add("island.collapsed/v1", {
    id: "stock-bar",
    hideable: true,
    opens: PAGE_ID,
    label: PAGE_TITLE,
    component: StockCollapsed,
  });
}
