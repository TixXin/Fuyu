import type { ReactNode } from "react";
import { AreaSpark, FocusChart, MiniSpark } from "./chart.tsx";
import { ChevronIcon, RefreshIcon, SettingsIcon } from "./icons.tsx";
import {
  formatChange,
  formatPercent,
  formatPrice,
  marketBadge,
  trendOf,
  type Quote,
  type StockItem,
  type StockState,
  type TrendSeries,
} from "./model.ts";
import { clock, quoteClock, text } from "./text.ts";
import "./views.css";

export interface ViewProps {
  state: StockState;
  activeStock: StockItem;
  now: number;
  gradId: string;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  onOpenSettings: (() => unknown) | null;
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

export function PanelHeader({
  state,
  showStatus,
  extra,
  onRefresh,
  onOpenSettings,
}: {
  state: StockState;
  showStatus: boolean;
  extra?: ReactNode;
  onRefresh: () => void;
  onOpenSettings: (() => unknown) | null;
}) {
  const { settings } = state;
  const counts = summaryCounts(settings.stocks, state.quotes);
  const statusLabel = text.status[state.status];
  const updated = state.updatedAt ? clock(state.updatedAt) : "";
  return (
    <div className="fuyu-stock__panel-head">
      <div className="fuyu-stock__panel-meta">
        {showStatus && (
          <span className={`fuyu-stock__status is-${state.status}`}>
            <span className="fuyu-stock__dot" />
            <span className="fuyu-stock__status-text">{[statusLabel, updated].filter(Boolean).join(" · ")}</span>
          </span>
        )}
        {(counts.up > 0 || counts.down > 0) && (
          <span className="fuyu-stock__tally">
            {counts.up > 0 && <span className="fuyu-stock__tally-up">{`↑${counts.up}`}</span>}
            {counts.down > 0 && <span className="fuyu-stock__tally-down">{`↓${counts.down}`}</span>}
          </span>
        )}
        {settings.sample && onOpenSettings && (
          <button type="button" className="fuyu-stock__sample-pill" onClick={() => void onOpenSettings()}>
            <span>{`${text.sampleTag} · ${text.manage}`}</span>
            <ChevronIcon size={11} />
          </button>
        )}
      </div>
      <div className="fuyu-stock__actions">
        {extra}
        <button
          type="button"
          className="fuyu-stock__icon-btn"
          disabled={state.loading}
          title={state.loading ? text.refreshing : text.refresh}
          aria-label={state.loading ? text.refreshing : text.refresh}
          onClick={onRefresh}
        >
          <RefreshIcon size={13} />
        </button>
        {onOpenSettings && (
          <button
            type="button"
            className="fuyu-stock__icon-btn"
            title={text.settingsTip}
            aria-label={text.settingsTip}
            onClick={() => void onOpenSettings()}
          >
            <SettingsIcon size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

export function WatchRow({
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

export function SplitView({ state, activeStock, now, gradId, onSelect, onRefresh, onOpenSettings }: ViewProps) {
  const quote = state.quotes[activeStock.id];
  const series = state.trends?.[activeStock.id];
  const trend = trendOf(quote);
  const hasQuote = Boolean(quote && quote.price !== null);
  const statusLabel = text.status[state.status];
  const updated = state.updatedAt ? clock(state.updatedAt) : "";
  const preClose = quote?.preClose ?? series?.preClose ?? null;
  return (
    <div className="fuyu-stock__layout">
      <div className={`fuyu-stock__focus is-${trend}`}>
        <div className="fuyu-stock__focus-head">
          <span className="fuyu-stock__focus-id">
            <strong className="fuyu-stock__focus-name">{activeStock.name}</strong>
            <span className="fuyu-stock__mkt">{marketBadge(activeStock)}</span>
            <span className="fuyu-stock__focus-code">{activeStock.code.replace(/_/g, ".")}</span>
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
      <div className="fuyu-stock__panel">
        <PanelHeader state={state} showStatus={false} onRefresh={onRefresh} onOpenSettings={onOpenSettings} />
        <ul className="fuyu-stock__list">
          {state.settings.stocks.map((stock) => (
            <WatchRow
              key={stock.id}
              stock={stock}
              quote={state.quotes[stock.id]}
              series={state.trends?.[stock.id]}
              selected={stock.id === activeStock.id}
              now={now}
              onSelect={() => onSelect(stock.id)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

export function TilesView({ state, activeStock, gradId, onSelect, onRefresh, onOpenSettings }: ViewProps) {
  return (
    <div className="fuyu-stock__view">
      <PanelHeader state={state} showStatus onRefresh={onRefresh} onOpenSettings={onOpenSettings} />
      <div className="fuyu-stock__tiles">
        {state.settings.stocks.map((stock, index) => {
          const quote = state.quotes[stock.id];
          const series = state.trends?.[stock.id];
          const trend = trendOf(quote);
          const hasQuote = Boolean(quote && quote.price !== null);
          const selected = stock.id === activeStock.id;
          return (
            <button
              key={stock.id}
              type="button"
              className={selected ? `fuyu-stock__tile is-${trend} is-selected` : `fuyu-stock__tile is-${trend}`}
              aria-pressed={selected}
              onClick={() => onSelect(stock.id)}
            >
              <div className="fuyu-stock__tile-top">
                <span className="fuyu-stock__who">
                  <span className="fuyu-stock__name">{stock.name}</span>
                  <span className="fuyu-stock__code">{`${marketBadge(stock)} ${stock.code.replace(/_/g, ".")}`}</span>
                </span>
                <span className="fuyu-stock__pill">{hasQuote && quote ? formatPercent(quote.percent) : "--"}</span>
              </div>
              <div className="fuyu-stock__tile-mid">
                <span className="fuyu-stock__tile-price">{hasQuote && quote ? formatPrice(quote.price) : "--"}</span>
                <span className="fuyu-stock__tile-chg">{hasQuote && quote ? formatChange(quote.change, quote.price) : ""}</span>
              </div>
              <AreaSpark series={series} trend={trend} gradId={`${gradId}-t-${index}`} height={22} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
