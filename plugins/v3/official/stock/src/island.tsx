import type { Context } from "@fuyu/plugin-base";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowIcon, StockIcon } from "./icons.tsx";
import {
  METHODS,
  displayCode,
  formatPercent,
  formatPrice,
  trendOf,
  type ColorScheme,
} from "./model.ts";
import { PAGE_TITLE, text } from "./text.ts";
import { useStocks } from "./useStocks.ts";
import { SplitView, TilesView, type ViewProps } from "./views.tsx";
import { CardsView, DualView, TableView } from "./viewsMore.tsx";
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

    const viewProps: ViewProps = {
      state,
      activeStock,
      now: Date.now(),
      gradId,
      onSelect: setSelectedId,
      onRefresh: () => invoke(METHODS.refresh),
      onOpenSettings: openSettings,
    };

    const renderView = () => {
      switch (settings.layout) {
        case "tiles":
          return <TilesView {...viewProps} />;
        case "dual":
          return <DualView {...viewProps} />;
        case "table":
          return <TableView {...viewProps} />;
        case "cards":
          return <CardsView {...viewProps} />;
        default:
          return <SplitView {...viewProps} />;
      }
    };

    return (
      <div className={`fuyu-stock${schemeClass(settings.colorScheme)}`}>
        {renderView()}
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
