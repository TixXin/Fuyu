import { Check } from "lucide-react";
import type { MarketCatalogBundle, MarketCatalogPlugin } from "@fuyu/plugin-services";
import { useLocale, useTranslation } from "../../i18n";
import { bundleSummary } from "./pluginBundles";
import { iconSources } from "./pluginIconSources";
import { PluginLogo } from "./PluginLogo";
import { localized } from "./pluginMarketModel";
import "./PluginMarketBundles.css";

const MAX_ICONS = 4;

export function PluginMarketBundles({ bundles, plugins, onOpen }: {
  bundles: readonly MarketCatalogBundle[];
  plugins: readonly MarketCatalogPlugin[];
  onOpen: (id: string) => void;
}) {
  const text = useTranslation().settings.pluginsV3.marketPage.bundles;
  const { locale } = useLocale();
  if (bundles.length === 0) return null;
  const byName = new Map(plugins.map((plugin) => [plugin.name, plugin]));
  return (
    <section className="market-section" data-market-section="bundles">
      <h3 className="plugin-page__heading">{text.heading}<span className="plugin-page__heading-meta">{text.hint}</span></h3>
      <div className="market-grid">
        {bundles.map((bundle) => {
          const title = localized(bundle.displayName, locale, bundle.id);
          const summary = bundleSummary(bundle);
          const label = summary.action === "install-all" ? text.installAll : summary.action === "install-rest" ? text.installRest(summary.available) : text.installUsable(summary.available);
          return (
            <article key={bundle.id} className="market-card market-bundle" data-market-bundle={bundle.id} data-bundle-action={summary.action} onClick={(event) => !(event.target as Element).closest("button") && onOpen(bundle.id)}>
              <div className="market-card__main">
                <div className="market-bundle__icons" aria-hidden="true">
                  {bundle.members.slice(0, MAX_ICONS).map((member) => {
                    const plugin = byName.get(member.name);
                    return <PluginLogo key={member.name} sources={iconSources(plugin?.icon)} title={plugin ? localized(plugin.displayName, locale, member.name) : member.name} size="sm" dim={member.state === "unavailable"} />;
                  })}
                  {bundle.members.length > MAX_ICONS ? <span className="market-bundle__more">{`+${bundle.members.length - MAX_ICONS}`}</span> : null}
                </div>
                <button className="market-card__name" type="button" title={title} onClick={() => onOpen(bundle.id)}>{title}</button>
                <p className="market-card__desc">{localized(bundle.description, locale, "")}</p>
              </div>
              <div className="market-card__foot">
                <span className="market-card__facts">{summary.owned > 0 ? text.owned(summary.owned, summary.total) : text.count(summary.total)}</span>
                <span className="market-card__action">
                  {summary.action === "done" ? (
                    <span className="market-card__installed"><Check size={13} strokeWidth={2.4} aria-hidden="true" />{summary.unavailable > 0 ? text.doneUsable : text.done}</span>
                  ) : (
                    <button className="plugin-btn plugin-btn--sm plugin-btn--primary" type="button" data-action="bundle-install" onClick={() => onOpen(bundle.id)}>{label}</button>
                  )}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
