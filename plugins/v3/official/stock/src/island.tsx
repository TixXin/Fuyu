import type { Context } from "@fuyu/plugin-base";
import { useEffect, useRef, useState } from "react";
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

function Row({ stock, quote, now }: { stock: StockItem; quote: Quote | undefined; now: number }) {
  const trend = trendOf(quote);
  const tip = quote?.time ? `${stock.name} · ${text.quoteTime(quoteClock(quote.time, now))}` : stock.name;
  const hasQuote = Boolean(quote && quote.price !== null);
  return (
    <li className={`fuyu-stock__row is-${trend}`} title={tip}>
      <span className="fuyu-stock__accent" aria-hidden="true" />
      <span className="fuyu-stock__who">
        <span className="fuyu-stock__name">{stock.name}</span>
        <span className="fuyu-stock__sub">
          <span className="fuyu-stock__mkt">{marketBadge(stock)}</span>
          <span className="fuyu-stock__code">{stock.code.replace(/_/g, ".")}</span>
        </span>
      </span>
      {hasQuote && quote ? (
        <>
          <span className="fuyu-stock__price">
            <span className="fuyu-stock__num">{formatPrice(quote.price)}</span>
            <span className="fuyu-stock__change">{formatChange(quote.change, quote.price)}</span>
          </span>
          <span className="fuyu-stock__pill">{formatPercent(quote.percent)}</span>
        </>
      ) : (
        <span className="fuyu-stock__none">{text.noQuote}</span>
      )}
    </li>
  );
}

function StatusLine({ state }: { state: StockState }) {
  const parts: string[] = [];
  const label = text.status[state.status];
  if (label) parts.push(label);
  if (state.updatedAt) parts.push(text.updated(clock(state.updatedAt)));
  const counts = summaryCounts(state.settings.stocks, state.quotes);
  return (
    <span className={`fuyu-stock__status is-${state.status}`}>
      <span className="fuyu-stock__dot" />
      <span className="fuyu-stock__status-text">{parts.join(" · ") || text.title}</span>
      {(counts.up > 0 || counts.down > 0) && (
        <span className="fuyu-stock__tally">
          {counts.up > 0 && <span className="fuyu-stock__tally-up">{`↑${counts.up}`}</span>}
          {counts.down > 0 && <span className="fuyu-stock__tally-down">{`↓${counts.down}`}</span>}
        </span>
      )}
    </span>
  );
}

export default function apply(ctx: Context) {
  const openSettings = settingsOpener(ctx);

  function StockPage() {
    const { state, ready, error, invoke } = useStocks(ctx);
    const opened = useRef(false);
    const { settings } = state;

    useEffect(() => {
      if (!ready || opened.current) return;
      opened.current = true;
      if (settings.refreshOnOpen && settings.stocks.length > 0) invoke(METHODS.refresh, { soft: true });
    }, [ready, settings.refreshOnOpen, settings.stocks.length, invoke]);

    if (!ready) return <div className="fuyu-stock" />;

    if (settings.stocks.length === 0) {
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
    return (
      <div className={`fuyu-stock${schemeClass(settings.colorScheme)}`}>
        <div className="fuyu-stock__toolbar">
          <StatusLine state={state} />
          <div className="fuyu-stock__actions">
            <button
              type="button"
              className="fuyu-stock__icon-btn"
              disabled={state.loading}
              title={state.loading ? text.refreshing : text.refresh}
              aria-label={state.loading ? text.refreshing : text.refresh}
              onClick={() => invoke(METHODS.refresh)}
            >
              <RefreshIcon size={14} />
            </button>
            {openSettings && (
              <button
                type="button"
                className="fuyu-stock__icon-btn"
                title={text.settingsTip}
                aria-label={text.settingsTip}
                onClick={() => void openSettings()}
              >
                <SettingsIcon size={14} />
              </button>
            )}
          </div>
        </div>

        {settings.sample && openSettings && (
          <div className="fuyu-stock__sample">
            <span className="fuyu-stock__sample-text">{text.sampleNotice}</span>
            <button type="button" className="fuyu-stock__sample-btn" onClick={() => void openSettings()}>
              <span>{text.manage}</span>
              <ChevronIcon size={12} />
            </button>
          </div>
        )}

        <ul className="fuyu-stock__list">
          {settings.stocks.map((stock) => (
            <Row key={stock.id} stock={stock} quote={state.quotes[stock.id]} now={now} />
          ))}
        </ul>

        {state.source && <p className="fuyu-stock__foot">{text.sourceNote(text.source[state.source])}</p>}
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
