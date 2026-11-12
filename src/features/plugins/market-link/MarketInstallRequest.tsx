import { useEffect, useRef, type ReactNode } from "react";
import { Globe, X } from "lucide-react";
import { useLocale, useTranslation } from "../../../i18n";
import type { MarketPlugin, MarketSnapshot } from "../api";
import { marketRequestState } from "./requestState";
import "./MarketInstallRequest.css";

export function MarketInstallRequest({
  id,
  market,
  loading,
  loadError,
  renderItem,
  onDismiss,
}: {
  id: string;
  market: MarketSnapshot | null;
  loading: boolean;
  loadError: string | null;
  renderItem: (plugin: MarketPlugin) => ReactNode;
  onDismiss: () => void;
}) {
  const t = useTranslation();
  const text = t.settings.plugins.market.request;
  const { locale } = useLocale();
  const state = marketRequestState(id, market, loading, loadError);
  const card = useRef<HTMLElement>(null);

  useEffect(() => {
    if (state.kind === "found") card.current?.scrollIntoView({ block: "nearest" });
  }, [state.kind, id]);

  return (
    <section ref={card} className={`market-request market-request--${state.kind}`} aria-live="polite">
      <header className="market-request__head">
        <Globe size={16} strokeWidth={1.5} aria-hidden="true" />
        <div className="market-request__copy">
          <strong>{state.kind === "found" ? text.title(state.plugin.name[locale]) : text.titleUnknown}</strong>
          <span>
            {state.kind === "found" ? text.hint : state.kind === "missing" ? text.missing(id) : state.kind === "failed" ? text.failed : text.loading}
          </span>
        </div>
        <button className="market-request__dismiss" type="button" aria-label={text.dismiss} title={text.dismiss} onClick={onDismiss}>
          <X size={14} strokeWidth={1.8} />
        </button>
      </header>
      {state.kind === "found" ? <div className="market-request__item">{renderItem(state.plugin)}</div> : null}
    </section>
  );
}
