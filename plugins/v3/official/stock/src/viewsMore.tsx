import { useState } from "react";
import { AreaSpark, MiniSpark } from "./chart.tsx";
import { formatChange, formatPercent, formatPrice, marketBadge, marketOf, trendOf } from "./model.ts";
import { text } from "./text.ts";
import { PanelHeader, WatchRow, type ViewProps } from "./views.tsx";

type MarketFilter = "all" | "cn" | "hk" | "us";

export function DualView({ state, activeStock, now, onSelect, onRefresh, onOpenSettings }: ViewProps) {
  const { stocks } = state.settings;
  const stripCount = stocks.length >= 7 ? 3 : stocks.length >= 5 ? 2 : stocks.length <= 3 ? stocks.length : 0;
  const stripStocks = stocks.slice(0, stripCount);
  const restStocks = stocks.slice(stripCount);
  const selQuote = state.quotes[activeStock.id];
  const selSeries = state.trends?.[activeStock.id];
  const preClose = selQuote?.preClose ?? selSeries?.preClose ?? null;
  return (
    <div className="fuyu-stock__view">
      <PanelHeader state={state} showStatus onRefresh={onRefresh} onOpenSettings={onOpenSettings} />
      {stripStocks.length > 0 && (
        <div className={`fuyu-stock__strip is-cols-${stripStocks.length}`}>
          {stripStocks.map((stock) => {
            const quote = state.quotes[stock.id];
            const series = state.trends?.[stock.id];
            const trend = trendOf(quote);
            const hasQuote = Boolean(quote && quote.price !== null);
            const selected = stock.id === activeStock.id;
            return (
              <button
                key={stock.id}
                type="button"
                className={selected ? `fuyu-stock__strip-card is-${trend} is-selected` : `fuyu-stock__strip-card is-${trend}`}
                aria-pressed={selected}
                onClick={() => onSelect(stock.id)}
              >
                <span className="fuyu-stock__strip-left">
                  <span className="fuyu-stock__strip-name">{stock.name}</span>
                  <span className="fuyu-stock__strip-price">{hasQuote && quote ? formatPrice(quote.price) : "--"}</span>
                </span>
                <span className="fuyu-stock__strip-right">
                  <span className="fuyu-stock__strip-pct">{hasQuote && quote ? formatPercent(quote.percent) : "--"}</span>
                  <MiniSpark series={series} trend={trend} />
                </span>
              </button>
            );
          })}
        </div>
      )}
      {restStocks.length > 0 && (
        <ul className="fuyu-stock__dual-list">
          {restStocks.map((stock) => (
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
      )}
      <div className="fuyu-stock__foot">
        <span className="fuyu-stock__foot-id">
          <span>{`${text.selectedLabel}：`}</span>
          <strong>{activeStock.name}</strong>
          <span className="fuyu-stock__mkt">{marketBadge(activeStock)}</span>
        </span>
        <span className="fuyu-stock__foot-vals">
          <span>{`${text.open} ${formatPrice(selQuote?.open ?? null)}`}</span>
          <span>{`${text.high} ${formatPrice(selQuote?.high ?? null)}`}</span>
          <span>{`${text.low} ${formatPrice(selQuote?.low ?? null)}`}</span>
          <span>{`${text.preClose} ${formatPrice(preClose)}`}</span>
        </span>
      </div>
    </div>
  );
}

export function TableView({ state, activeStock, onSelect, onRefresh, onOpenSettings }: ViewProps) {
  const [filter, setFilter] = useState<MarketFilter>("all");
  const filtered = state.settings.stocks.filter((stock) => filter === "all" || marketOf(stock.id) === filter);
  const filters: readonly (readonly [MarketFilter, string])[] = [
    ["all", text.filterAll],
    ["cn", text.filterCn],
    ["hk", text.filterHk],
    ["us", text.filterUs],
  ];
  const tabs = (
    <div className="fuyu-stock__tabs" role="tablist">
      {filters.map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={filter === key}
          className={filter === key ? "fuyu-stock__tab is-on" : "fuyu-stock__tab"}
          onClick={() => setFilter(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
  return (
    <div className="fuyu-stock__view">
      <PanelHeader state={state} showStatus extra={tabs} onRefresh={onRefresh} onOpenSettings={onOpenSettings} />
      <div className="fuyu-stock__table">
        <div className="fuyu-stock__thead">
          <span>{text.colSymbol}</span>
          <span>{text.colTrend}</span>
          <span className="is-r">{text.colPrice}</span>
          <span className="is-r is-col-chg">{text.colChange}</span>
          <span className="is-r">{text.colPercent}</span>
          <span className="is-col-rng">{text.colRange}</span>
        </div>
        <div className="fuyu-stock__tbody">
          {filtered.map((stock) => {
            const quote = state.quotes[stock.id];
            const series = state.trends?.[stock.id];
            const trend = trendOf(quote);
            const hasQuote = Boolean(quote && quote.price !== null);
            const selected = stock.id === activeStock.id;
            const low = quote?.low ?? null;
            const high = quote?.high ?? null;
            const pos =
              low !== null && high !== null && quote?.price !== null && quote?.price !== undefined && high > low
                ? Math.max(6, Math.min(94, ((quote.price - low) / (high - low)) * 100))
                : null;
            return (
              <button
                key={stock.id}
                type="button"
                className={selected ? `fuyu-stock__tr is-${trend} is-selected` : `fuyu-stock__tr is-${trend}`}
                aria-pressed={selected}
                onClick={() => onSelect(stock.id)}
              >
                <span className="fuyu-stock__tname">
                  <span className="fuyu-stock__mkt">{marketBadge(stock)}</span>
                  <span className="fuyu-stock__name">{stock.name}</span>
                  <span className="fuyu-stock__tcode">{stock.code.replace(/_/g, ".")}</span>
                </span>
                <span className="fuyu-stock__spark-cell">
                  <MiniSpark series={series} trend={trend} />
                </span>
                <span className="fuyu-stock__num is-r">{hasQuote && quote ? formatPrice(quote.price) : "--"}</span>
                <span className="fuyu-stock__tchg is-r is-col-chg">{hasQuote && quote ? formatChange(quote.change, quote.price) : "--"}</span>
                <span className="is-r">
                  <span className="fuyu-stock__pill">{hasQuote && quote ? formatPercent(quote.percent) : "--"}</span>
                </span>
                <span className="fuyu-stock__trange is-col-rng">
                  {pos !== null && low !== null && high !== null ? (
                    <>
                      <span>{formatPrice(low)}</span>
                      <span className="fuyu-stock__ttrack">
                        <span className="fuyu-stock__tdot" style={{ left: `${pos}%` }} />
                      </span>
                      <span>{formatPrice(high)}</span>
                    </>
                  ) : (
                    <span>--</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CardsView({ state, activeStock, gradId, onSelect, onRefresh, onOpenSettings }: ViewProps) {
  const { stocks } = state.settings;
  const pageSize = 4;
  const pageCount = Math.max(1, Math.ceil(stocks.length / pageSize));
  const [page, setPage] = useState(0);
  const safePage = Math.min(page, pageCount - 1);
  const visible = stocks.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const pager =
    pageCount > 1 ? (
      <div className="fuyu-stock__tabs">
        {Array.from({ length: pageCount }, (_, i) => {
          const from = i * pageSize + 1;
          const to = Math.min(stocks.length, (i + 1) * pageSize);
          return (
            <button
              key={i}
              type="button"
              className={safePage === i ? "fuyu-stock__tab is-on" : "fuyu-stock__tab"}
              onClick={() => setPage(i)}
            >
              {`${from}–${to}`}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <div className="fuyu-stock__view">
      <PanelHeader state={state} showStatus extra={pager} onRefresh={onRefresh} onOpenSettings={onOpenSettings} />
      <div className="fuyu-stock__cards">
        {visible.map((stock, index) => {
          const quote = state.quotes[stock.id];
          const series = state.trends?.[stock.id];
          const trend = trendOf(quote);
          const hasQuote = Boolean(quote && quote.price !== null);
          const selected = stock.id === activeStock.id;
          const preClose = quote?.preClose ?? series?.preClose ?? null;
          return (
            <button
              key={stock.id}
              type="button"
              className={selected ? `fuyu-stock__card is-${trend} is-selected` : `fuyu-stock__card is-${trend}`}
              aria-pressed={selected}
              onClick={() => onSelect(stock.id)}
            >
              <div className="fuyu-stock__card-top">
                <div className="fuyu-stock__card-head">
                  <span className="fuyu-stock__name">{stock.name}</span>
                  <span className="fuyu-stock__mkt">{marketBadge(stock)}</span>
                </div>
                <span className="fuyu-stock__code">{stock.code.replace(/_/g, ".")}</span>
                <span className="fuyu-stock__card-pct">{hasQuote && quote ? formatPercent(quote.percent) : "--"}</span>
                <span className="fuyu-stock__card-price">
                  <span>{hasQuote && quote ? formatPrice(quote.price) : "--"}</span>
                  {hasQuote && quote && <span className="fuyu-stock__card-delta">{formatChange(quote.change, quote.price)}</span>}
                </span>
              </div>
              <div className="fuyu-stock__card-bottom">
                <AreaSpark series={series} trend={trend} gradId={`${gradId}-c-${safePage}-${index}`} height={48} />
                <div className="fuyu-stock__card-foot">
                  <span>{`${text.open} ${formatPrice(quote?.open ?? null)}`}</span>
                  <span>{`${text.preClose} ${formatPrice(preClose)}`}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
