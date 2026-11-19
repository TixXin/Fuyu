import { useState } from "react";
import { ExternalLink, Search, Upload } from "lucide-react";
import type { MarketCatalogPlugin } from "@fuyu/plugin-services";
import type { PluginMarketSort } from "../../i18n/sections/settings/pluginMarket";
import { useLocale, useTranslation } from "../../i18n";
import { usePinyin } from "../../lib/pinyin/usePinyin";
import { iconSources } from "./pluginIconSources";
import { PluginLogo } from "./PluginLogo";
import { PluginMarketCard, type MarketCardHandlers } from "./PluginMarketCard";
import { PluginMarketEmpty } from "./PluginMarketEmpty";
import { openPluginDocs } from "./pluginMarketActions";
import { PluginMarketInstalled } from "./PluginMarketInstalled";
import { browseSections, categoryCounts, categoryNameMap, inCategory, localized, sortPlugins } from "./pluginMarketModel";
import { queryWantsPinyin, searchMarket } from "./marketSearch";
import { marketActionCandidate } from "./pluginRowStatus";

export function PluginMarketBrowse({ plugins, newNames, query, category, sort, categoryName, handlers, onCategory, onInstallFile }: {
  plugins: readonly MarketCatalogPlugin[];
  newNames: ReadonlySet<string>;
  query: string;
  category: string | null;
  sort: PluginMarketSort;
  categoryName: (id: string) => string;
  handlers: MarketCardHandlers;
  onCategory: (id: string | null) => void;
  onInstallFile: () => void;
}) {
  const text = useTranslation().settings.pluginsV3.marketPage;
  const { locale } = useLocale();
  const [ownedOpen, setOwnedOpen] = useState<boolean | null>(null);
  const pinyin = usePinyin(queryWantsPinyin(query));
  const grid = (list: readonly MarketCatalogPlugin[]) => (
    <div className="market-grid">
      {list.map((plugin) => <PluginMarketCard key={plugin.name} plugin={plugin} categoryName={categoryName} isNew={newNames.has(plugin.name)} {...handlers} />)}
    </div>
  );

  if (query.trim()) {
    const names = categoryNameMap(plugins, categoryName);
    const found = searchMarket(sortPlugins(plugins, sort), query, names, pinyin);
    if (found.length === 0) {
      return (
        <PluginMarketEmpty kind="no-result" icon={<Search size={22} strokeWidth={1.8} />} title={text.noResult.title(query.trim())} body={text.noResult.body}>
          <div className="market-empty__cats">
            {categoryCounts(plugins).map(({ id }) => (
              <button key={id} className="plugin-chip" type="button" data-market-category={id} onClick={() => onCategory(id)}>{categoryName(id)}</button>
            ))}
          </div>
          <button className="plugin-btn plugin-btn--sm" type="button" data-action="market-install-file" onClick={onInstallFile}>
            <Upload size={13} strokeWidth={2.2} aria-hidden="true" />
            {text.noResult.fromFile}
          </button>
          <button className="plugin-btn plugin-btn--sm plugin-btn--ghost" type="button" onClick={openPluginDocs}>
            <ExternalLink size={13} strokeWidth={2.2} aria-hidden="true" />
            {text.noResult.buildOwn}
          </button>
        </PluginMarketEmpty>
      );
    }
    return (
      <section className="market-section" data-market-section="results">
        <h3 className="plugin-page__heading">{text.sections.results(found.length)}</h3>
        {grid(found)}
      </section>
    );
  }

  if (category) {
    const list = sortPlugins(plugins.filter((plugin) => inCategory(plugin, category)), sort);
    return (
      <section className="market-section" data-market-section={`category:${category}`}>
        <h3 className="plugin-page__heading">{categoryName(category)}<span className="plugin-page__heading-meta">{text.sections.count(list.length)}</span></h3>
        {grid(list)}
      </section>
    );
  }

  const { updates, fresh, owned } = browseSections(plugins, sort);
  return (
    <>
      {updates.length > 0 ? (
        <section className="market-section" data-market-section="updates">
          <h3 className="plugin-page__heading">{text.sections.updates(updates.length)}</h3>
          <div className="plugin-card market-updates">
            {updates.map((plugin) => {
              const title = localized(plugin.displayName, locale, plugin.name);
              const candidate = marketActionCandidate(plugin)?.candidate;
              return (
                <div key={plugin.name} className="market-update" data-market-update={plugin.name}>
                  <PluginLogo sources={iconSources(plugin.icon)} title={title} size="sm" />
                  <div className="market-update__text">
                    <button className="market-card__name" type="button" onClick={() => handlers.onOpen(plugin)}>{title}</button>
                    <span>
                      {text.card.updateLine(plugin.installedVersion ?? "", candidate?.version ?? "")}
                      {candidate?.urgent ? <> · <span className="market-card__warn">{text.card.urgent}</span></> : null}
                      {candidate?.fresh ? ` · ${text.card.fresh}` : null}
                    </span>
                  </div>
                  <button className="plugin-btn plugin-btn--sm plugin-btn--primary" type="button" data-action="market-update" onClick={() => handlers.onInstall(plugin)}>{text.card.review}</button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
      {fresh.length > 0 ? (
        <section className="market-section" data-market-section="fresh">
          {updates.length > 0 || owned.length > 0 ? <h3 className="plugin-page__heading">{text.sections.fresh}<span className="plugin-page__heading-meta">{text.sections.count(fresh.length)}</span></h3> : null}
          {grid(fresh)}
        </section>
      ) : (
        <p className="plugin-foot" data-market-allset>{text.sections.allInstalled}</p>
      )}
      {owned.length > 0 ? <PluginMarketInstalled plugins={owned} open={ownedOpen ?? fresh.length === 0} onToggle={setOwnedOpen} categoryName={categoryName} handlers={handlers} /> : null}
    </>
  );
}
