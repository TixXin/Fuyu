import type { MarketPluginDetails } from "@fuyu/plugin-services";
import type { PluginMarketDetailTab } from "../../i18n/sections/settings/pluginMarket";
import { Markdown } from "../../components/markdown/Markdown";
import { useLocale, useTranslation } from "../../i18n";
import { openHttpUrl } from "./pluginMarketActions";
import { PluginCapabilities } from "./PluginCapabilities";
import { formatBytes, localized } from "./pluginMarketModel";

export function PluginMarketDetailTabBody({ tab, details, fallback }: {
  tab: PluginMarketDetailTab;
  details: MarketPluginDetails;
  fallback: string;
}) {
  const text = useTranslation().settings.pluginsV3.marketPage;
  const copy = text.detail;
  const { locale } = useLocale();

  if (tab === "changelog") {
    const body = details.changelog?.trim() ?? "";
    return body ? <Markdown className="market-markdown" text={body} onOpenLink={openHttpUrl} /> : <p className="plugin-callout">{copy.noChangelog}</p>;
  }

  if (tab === "readme") {
    const body = details.readme?.trim() || fallback;
    return (
      <>
        {body ? <Markdown className="market-markdown" text={body} onOpenLink={openHttpUrl} /> : <p className="plugin-callout">{copy.noReadme}</p>}
        <PluginCapabilities caps={details} />
        {details.commands.length > 0 ? (
          <>
            <h3 className="plugin-page__heading">{copy.commands}</h3>
            <ul className="plugin-card market-list" data-market-commands>
              {details.commands.map((command) => (
                <li key={command.id} className="market-list__row">
                  <span className="market-list__main">{localized(command.title, locale, command.id)}</span>
                  {command.keybinding ? <kbd className="plugin-kbd">{command.keybinding}</kbd> : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </>
    );
  }

  if (details.versions.length === 0) return <p className="plugin-callout">{copy.noVersions}</p>;
  return (
    <ul className="plugin-card market-list" data-market-versions>
      {details.versions.map((version) => {
        const meta = [version.publishedAt?.slice(0, 10), typeof version.size === "number" ? formatBytes(version.size) : null, version.enginesFuyu ? copy.requiresFuyu(version.enginesFuyu) : null].filter(Boolean).join(" · ");
        return (
          <li key={version.version} className="market-list__row" data-market-version={version.version}>
            <span className="market-list__main">
              <b>{`v${version.version}`}</b>
              {version.reviewed ? <span className="plugin-badge market-badge--ok">{copy.reviewed}</span> : null}
              {version.urgent ? <span className="plugin-badge plugin-badge--warn">{copy.urgent}</span> : null}
              {details.installedVersion === version.version ? <span className="plugin-badge">{copy.current}</span> : null}
            </span>
            {meta ? <span className="market-list__meta">{meta}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
