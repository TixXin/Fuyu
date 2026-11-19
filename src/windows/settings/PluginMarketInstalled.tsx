import { useId } from "react";
import { ChevronRight } from "lucide-react";
import type { MarketCatalogPlugin } from "@fuyu/plugin-services";
import { useLocale, useTranslation } from "../../i18n";
import { OfficialMark } from "./OfficialMark";
import { iconSources } from "./pluginIconSources";
import { PluginLogo } from "./PluginLogo";
import { PluginMarketCardAction, type MarketCardHandlers } from "./PluginMarketCard";
import { localized } from "./pluginMarketModel";

const PEEK = 5;

export function PluginMarketInstalled({ plugins, open, onToggle, categoryName, handlers }: {
  plugins: readonly MarketCatalogPlugin[];
  open: boolean;
  onToggle: (open: boolean) => void;
  categoryName: (id: string) => string;
  handlers: MarketCardHandlers;
}) {
  const text = useTranslation().settings.pluginsV3.marketPage;
  const { locale } = useLocale();
  const listId = useId();
  const titleOf = (plugin: MarketCatalogPlugin) => localized(plugin.displayName, locale, plugin.name);
  return (
    <section className="market-section market-owned" data-market-section="installed">
      <button className="market-owned__toggle" type="button" aria-expanded={open} aria-controls={listId} data-action="market-toggle-installed" onClick={() => onToggle(!open)}>
        <ChevronRight className="market-owned__chevron" size={14} strokeWidth={2.2} aria-hidden="true" />
        <span className="market-owned__label">{text.sections.installed(plugins.length)}</span>
        {open ? null : (
          <span className="market-owned__peek" aria-hidden="true">
            {plugins.slice(0, PEEK).map((plugin) => <PluginLogo key={plugin.name} sources={iconSources(plugin.icon)} title={titleOf(plugin)} size="sm" />)}
            {plugins.length > PEEK ? <span className="market-owned__more">+{plugins.length - PEEK}</span> : null}
          </span>
        )}
        <span className="market-owned__hint">{open ? text.sections.hideInstalled : text.sections.showInstalled}</span>
      </button>
      {open ? (
        <div className="plugin-card market-updates market-owned__list" id={listId}>
          {plugins.map((plugin) => {
            const title = titleOf(plugin);
            const sub = [plugin.installedVersion ? `v${plugin.installedVersion}` : null, plugin.official ? null : plugin.publisher.github, plugin.categories[0] ? categoryName(plugin.categories[0]) : null].filter(Boolean).join(" · ");
            return (
              <div key={plugin.name} className="market-update market-owned__row" data-market-plugin={plugin.name} onClick={(event) => !(event.target as Element).closest("button") && handlers.onOpen(plugin)}>
                <PluginLogo sources={iconSources(plugin.icon)} title={title} size="sm" />
                <div className="market-update__text">
                  <div className="market-card__line">
                    <button className="market-card__name" type="button" title={title} onClick={() => handlers.onOpen(plugin)}>{title}</button>
                    {plugin.official ? <OfficialMark /> : null}
                    {plugin.revoked ? <span className="plugin-badge market-badge--bad">{text.card.revoked}</span> : null}
                  </div>
                  <span>{sub}</span>
                </div>
                <span className="market-card__action">
                  <PluginMarketCardAction plugin={plugin} compact onInstall={handlers.onInstall} onManage={handlers.onManage} onGoUpdate={handlers.onGoUpdate} canOpenOnIsland={handlers.canOpenOnIsland} onOpenOnIsland={handlers.onOpenOnIsland} />
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
