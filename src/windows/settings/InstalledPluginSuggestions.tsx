import { Store } from "lucide-react";
import type { MarketCatalogPlugin, MarketCatalogSnapshot } from "@fuyu/plugin-services";
import { useLocale, useTranslation } from "../../i18n";
import { popularPlugins } from "./InstalledPluginsEmpty";
import { iconSources } from "./pluginIconSources";
import { localized } from "./pluginEntries";
import { PluginLogo } from "./PluginLogo";

export function InstalledPluginSuggestions({ snapshot, onBrowse, onInstall }: {
  snapshot: MarketCatalogSnapshot | null;
  onBrowse: () => void;
  onInstall: (plugin: MarketCatalogPlugin) => void;
}) {
  const text = useTranslation().settings.pluginsV3.page;
  const { locale } = useLocale();
  const picks = popularPlugins(snapshot);
  if (picks.length === 0) return null;
  const total = snapshot?.plugins.length ?? 0;
  return (
    <section className="plugin-suggest" data-suggestions>
      <h3 className="plugin-page__heading">
        <span>{text.suggest.title}</span>
        <button className="plugin-link plugin-suggest__all" type="button" data-action="all-plugins" onClick={onBrowse}>{text.suggest.all(total)}</button>
      </h3>
      <div className="plugin-suggest__grid">
        {picks.map((plugin) => {
          const title = localized(plugin.displayName, locale) ?? plugin.name;
          return (
            <div key={plugin.name} className="plugin-suggest__card" data-suggest={plugin.name}>
              <div className="plugin-suggest__head">
                <PluginLogo sources={iconSources(plugin.icon)} title={title} size="sm" />
                <b title={title}>{title}</b>
              </div>
              <p>{localized(plugin.description, locale)}</p>
              <button className="plugin-btn plugin-btn--sm plugin-btn--primary" type="button" data-action="install-suggested" onClick={() => onInstall(plugin)}>{text.empty.install}</button>
            </div>
          );
        })}
        <button className="plugin-suggest__card plugin-suggest__browse" type="button" data-action="browse-market" onClick={onBrowse}>
          <Store size={20} strokeWidth={2} aria-hidden="true" />
          <b>{text.suggest.browse}</b>
          <span>{text.suggest.browseHint}</span>
        </button>
      </div>
    </section>
  );
}
