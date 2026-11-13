import { useMemo, useState } from "react";
import { RefreshCcw, Search, ShieldCheck, Store } from "lucide-react";
import { SelectControl } from "../../components/controls/SelectControl";
import { useLocale, useTranslation } from "../../i18n";
import { MARKET_CATEGORIES, type MarketCategory, type MarketPlugin, type PluginsSnapshot } from "./api";
import { filterMarketPlugins, usedCategories } from "./marketFilter";
import { useMarketFavorites } from "./marketFavorites";
import { sortMarketPlugins, useMarketLikes, type MarketSort } from "./marketLikes";
import { groupMarketPlugins } from "./marketGroups";
import { MarketPluginItem } from "./MarketPluginItem";
import { MarketInstallRequest } from "./market-link/MarketInstallRequest";
import { usePluginMarket } from "./usePluginMarket";
import "./PluginToolbar.css";
import "./PluginMarketSection.css";

const FAVORITES = "favorites";

const time = (at: number) => new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

export function PluginMarketSection({
  onInstalled,
  onManage,
  requestedId,
  onDismissRequest,
}: {
  onInstalled?: (snapshot: PluginsSnapshot) => void;
  onManage?: (id: string) => void;
  requestedId?: string | null;
  onDismissRequest?: () => void;
} = {}) {
  const t = useTranslation();
  const text = t.settings.plugins.market;
  const { locale } = useLocale();
  const { market, loadedAt, loading, loadError, installError, installingId, refresh, install } = usePluginMarket(onInstalled);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MarketCategory | "" | typeof FAVORITES>("");
  const { favorites, toggleFavorite } = useMarketFavorites();
  const likes = useMarketLikes(loadedAt);
  const hasLikes = Object.keys(likes).length > 0;
  const [sort, setSort] = useState<MarketSort>("index");
  const failedPlugin = installError && market?.plugins.find((plugin) => plugin.id === installError.id);
  const categories = useMemo(() => (market ? usedCategories(market.plugins, MARKET_CATEGORIES) : []), [market]);
  const shown = useMemo(() => {
    if (!market) return [];
    const plugins = category === FAVORITES ? market.plugins.filter((plugin) => favorites.includes(plugin.id)) : market.plugins;
    return filterMarketPlugins(plugins, { query, category: category === FAVORITES ? "" : category }, market.officialPublisher);
  }, [market, query, category, favorites]);
  const groups = useMemo(() => groupMarketPlugins(sortMarketPlugins(shown, hasLikes ? sort : "index", likes)), [shown, sort, likes, hasLikes]);
  const totals = useMemo(() => groupMarketPlugins(market?.plugins ?? []), [market]);
  const hasPlugins = Boolean(market && market.plugins.length > 0);
  const status = loading
    ? text.refreshing
    : market
      ? loadedAt !== null
        ? text.status(market.plugins.length, time(loadedAt))
        : text.statusCount(market.plugins.length)
      : "";
  const renderItem = (plugin: MarketPlugin) =>
    market ? (
      <MarketPluginItem
        key={plugin.id}
        plugin={plugin}
        market={market}
        installingId={installingId}
        favorite={favorites.includes(plugin.id)}
        like={likes[plugin.id]}
        onToggleFavorite={toggleFavorite}
        onInstall={(id, trust, acceptKeyChange) => void install(id, trust, acceptKeyChange)}
        onManage={onManage}
      />
    ) : null;
  const renderGroup = (title: string, plugins: MarketPlugin[]) =>
    plugins.length > 0 ? (
      <div className="plugin-market__group" role="group" aria-label={title}>
        <h3 className="plugin-market__group-title">{title}</h3>
        <div className="plugin-market__grid">{plugins.map(renderItem)}</div>
      </div>
    ) : null;
  const showFilters = hasPlugins || (market === null && !loadError);

  return (
    <section className="settings-section settings-section--list plugins-panel">
      <div className="plugin-market__header">
        <span className="plugin-market__hero-icon" aria-hidden="true">
          <Store size={18} strokeWidth={2} />
        </span>
        <div className="plugin-market__headline">
          <span className="plugin-market__status" aria-live="polite">
            {status}
          </span>
          {market && hasPlugins ? (
            <span className="plugin-market__summary-line">{text.summary(totals.installed.length + totals.updates.length, totals.updates.length, favorites.length)}</span>
          ) : null}
        </div>
        <button className="plugin-card__button plugin-market__refresh" type="button" aria-label={text.refresh} disabled={loading} onClick={() => void refresh()}>
          <RefreshCcw className={loading ? "plugin-market__spin" : undefined} size={14} strokeWidth={2.2} />
        </button>
      </div>
      {requestedId ? (
        <MarketInstallRequest
          id={requestedId}
          market={market}
          loading={loading}
          loadError={loadError || null}
          renderItem={renderItem}
          onDismiss={() => onDismissRequest?.()}
        />
      ) : null}
      {loadError ? (
        <div className="plugin-market__failure" role="alert">
          <p className="plugin-card__error">{text.loadFailed}</p>
          <p className="plugin-market__detail">{loadError}</p>
        </div>
      ) : null}
      {installError ? (
        <div className="plugin-market__failure" role="alert">
          <p className="plugin-card__error">{text.installFailed(failedPlugin ? failedPlugin.name[locale] : installError.id)}</p>
          <p className="plugin-market__detail">{installError.detail}</p>
        </div>
      ) : null}
      {market && !hasPlugins ? <p className="settings-section__hint">{text.empty}</p> : null}
      {showFilters ? (
        <div className="plugin-market__filters">
          <label className="plugin-search">
            <Search size={13} strokeWidth={2.4} aria-hidden="true" />
            <input
              type="search"
              value={query}
              placeholder={text.search}
              aria-label={text.search}
              onChange={(event) => setQuery(event.currentTarget.value)}
              onKeyDown={(event) => event.key === "Escape" && query && (event.preventDefault(), setQuery(""))}
            />
          </label>
          {market === null || hasPlugins ? (
            <div className="plugin-market__categories" role="group">
              {(["", FAVORITES, ...categories] as const).map((name) => (
                <button
                  key={name || "all"}
                  className="plugin-chip plugin-market__category"
                  type="button"
                  aria-pressed={category === name}
                  onClick={() => setCategory(name)}
                >
                  <span>{name === "" ? text.allCategories : name === FAVORITES ? text.favorites(favorites.length) : text.category[name]}</span>
                </button>
              ))}
            </div>
          ) : null}
          {hasLikes ? (
            <div className="plugin-market__sort">
              <SelectControl
                value={sort}
                ariaLabel={text.sortLabel}
                options={[{ value: "index", label: text.sortIndex }, { value: "likes", label: text.sortLikes }]}
                onChange={setSort}
              />
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="plugin-market__list" aria-busy={loading}>
        {market === null && loading ? (
          <>
            <p className="settings-section__hint">{text.loading}</p>
            {[0, 1, 2].map((index) => (
              <div key={index} className="plugin-market__item plugin-market__placeholder" aria-hidden="true" />
            ))}
          </>
        ) : null}
        {hasPlugins && shown.length === 0 ? <p className="settings-section__hint">{category === FAVORITES && !query ? text.noFavorites : text.noMatches}</p> : null}
        {renderGroup(text.groupUpdates(groups.updates.length), groups.updates)}
        {renderGroup(text.groupInstallable(groups.installable.length), groups.installable)}
        {renderGroup(text.groupInstalled(groups.installed.length), groups.installed)}
      </div>
      <p className="plugin-market__footnote">
        <ShieldCheck size={13} strokeWidth={2.2} aria-hidden="true" />
        <span>{text.hint}</span>
      </p>
    </section>
  );
}
