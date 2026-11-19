import { Blocks, Store, Upload } from "lucide-react";
import type { MarketCatalogPlugin, MarketCatalogSnapshot } from "@fuyu/plugin-services";
import { useLocale, useTranslation } from "../../i18n";
import { iconSources } from "./pluginIconSources";
import { PluginLogo } from "./PluginLogo";
import { localized } from "./pluginEntries";
import { marketActionCandidate } from "./pluginRowStatus";

export function popularPlugins(snapshot: MarketCatalogSnapshot | null): MarketCatalogPlugin[] {
  return (snapshot?.plugins ?? [])
    .filter((plugin) => !plugin.installedVersion && !plugin.revoked && !plugin.blocked && marketActionCandidate(plugin))
    .sort((a, b) => Number(b.official) - Number(a.official))
    .slice(0, 3);
}

export function InstalledPluginsEmpty({ snapshot, onBrowse, onInstallFile, onInstall }: {
  snapshot: MarketCatalogSnapshot | null;
  onBrowse: () => void;
  onInstallFile: () => void;
  onInstall: (plugin: MarketCatalogPlugin) => void;
}) {
  const text = useTranslation().settings.pluginsV3.page;
  const { locale } = useLocale();
  const popular = popularPlugins(snapshot);
  return (
    <>
      <div className="plugin-card plugin-empty" data-empty>
        <span className="plugin-empty__icon" aria-hidden="true"><Blocks size={24} strokeWidth={1.8} /></span>
        <h3 className="plugin-empty__title">{text.empty.title}</h3>
        <p>{text.empty.body}</p>
        <div className="plugin-empty__actions">
          <button className="plugin-btn plugin-btn--primary" type="button" data-action="browse-market" onClick={onBrowse}>
            <Store size={14} strokeWidth={2.2} aria-hidden="true" />
            {text.browseMarket}
          </button>
          <button className="plugin-btn" type="button" data-action="install-file" onClick={onInstallFile}>
            <Upload size={14} strokeWidth={2.2} aria-hidden="true" />
            {text.menu.installFromFile}
          </button>
        </div>
      </div>
      {popular.length > 0 ? (
        <>
          <h3 className="plugin-page__heading">{text.empty.popular}</h3>
          <div className="plugin-mini-grid">
            {popular.map((plugin) => {
              const title = localized(plugin.displayName, locale) ?? plugin.name;
              return (
                <div key={plugin.name} className="plugin-mini" data-popular={plugin.name}>
                  <PluginLogo sources={iconSources(plugin.icon)} title={title} size="sm" />
                  <div className="plugin-mini__text">
                    <b>{title}</b>
                    <span>{localized(plugin.description, locale)}</span>
                  </div>
                  <button className="plugin-btn plugin-btn--sm plugin-btn--primary" type="button" onClick={() => onInstall(plugin)}>{text.empty.install}</button>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </>
  );
}
