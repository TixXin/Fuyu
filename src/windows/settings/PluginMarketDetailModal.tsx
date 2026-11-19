import { useEffect, useState, type KeyboardEvent } from "react";
import { ExternalLink, LoaderCircle, X } from "lucide-react";
import type { MarketCatalogPlugin, MarketPluginDetails } from "@fuyu/plugin-services";
import type { PluginMarketDetailTab } from "../../i18n/sections/settings/pluginMarket";
import { useErrorText, useLocale, useTranslation } from "../../i18n";
import { PluginMarketCardAction, type MarketCardHandlers } from "./PluginMarketCard";
import { PluginMarketDetailTabBody } from "./PluginMarketDetailTabs";
import { pluginInitial } from "./InstalledPluginRow";
import { PluginMarketDialog } from "./PluginMarketDialog";
import { isHttpUrl, marketClient, openHttpUrl } from "./pluginMarketActions";
import { formatBytes, localized, offeredCandidate } from "./pluginMarketModel";

const TABS: readonly PluginMarketDetailTab[] = ["readme", "changelog", "versions"];
const LINKS = ["repository", "homepage", "bugs", "funding"] as const;

export function PluginMarketDetailModal({ plugin, categoryName, nameOf, onClose, ...handlers }: Omit<MarketCardHandlers, "onOpen"> & {
  plugin: MarketCatalogPlugin;
  categoryName: (id: string) => string;
  nameOf: (id: string) => string;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const text = useTranslation().settings.pluginsV3.marketPage;
  const copy = text.detail;
  const errorText = useErrorText();
  const [details, setDetails] = useState<MarketPluginDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<PluginMarketDetailTab>("readme");

  useEffect(() => {
    let live = true;
    void marketClient
      .details({ name: plugin.name, locale })
      .then((res) => live && setDetails(res))
      .catch((failure: unknown) => live && setError(errorText(failure)));
    return () => {
      live = false;
    };
  }, [errorText, locale, plugin.name]);

  const title = localized(details?.displayName, locale, localized(plugin.displayName, locale, plugin.name));
  const fallback = localized(details?.description, locale, localized(plugin.description, locale, ""));
  const candidate = offeredCandidate(plugin);
  const latest = details?.latestVersion ?? candidate?.version ?? plugin.installedVersion;
  const latestEntry = details?.versions.find((item) => item.version === latest);
  const size = latestEntry?.size ?? (candidate?.version === latest ? candidate.size : null);
  const published = latestEntry?.publishedAt ?? (candidate?.version === latest ? candidate.publishedAt : null);
  const publisher = plugin.official ? copy.official : details?.publisherName || details?.author || plugin.publisher.github;
  const category = plugin.categories[0] ? categoryName(plugin.categories[0]) : null;
  const sub = [publisher, details && details.likes !== null ? copy.likes(details.likes) : null, category].filter(Boolean).join(" · ");
  const requires = [latestEntry?.enginesFuyu ? copy.requiresFuyu(latestEntry.enginesFuyu) : null, ...Object.keys(details?.requires ?? {}).map(nameOf)].filter(Boolean).join(" · ");
  const info: [string, string | null | undefined][] = [
    [copy.info.version, latest ? `v${latest}` : null],
    [copy.info.size, typeof size === "number" ? formatBytes(size) : null],
    [copy.info.updated, published?.slice(0, 10)],
    [copy.info.requires, requires || null],
    [copy.info.platforms, details?.platforms.map((item) => copy.platforms[item] ?? item).join(" · ") || null],
    [copy.info.license, details?.license],
  ];
  const links = LINKS.flatMap((key) => (isHttpUrl(details?.[key]) ? [{ key, url: details[key] as string }] : []));
  const shots = (details?.screenshots ?? []).filter((shot) => isHttpUrl(shot.url));

  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = TABS[(TABS.indexOf(tab) + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    setTab(next);
    const list = event.currentTarget;
    requestAnimationFrame(() => list.querySelector<HTMLButtonElement>(`[data-detail-tab='${next}']`)?.focus());
  };

  return (
    <PluginMarketDialog label={title} size="wide" onClose={onClose} data={{ "data-market-detail-modal": plugin.name }}>
      <div className="plugin-dialog__head">
        <span className="plugin-icon plugin-icon--lg" aria-hidden="true">{pluginInitial(title)}</span>
        <div className="plugin-dialog__heading">
          <div className="market-card__line">
            <span className="plugin-dialog__title">{title}</span>
            {plugin.official ? <span className="plugin-badge plugin-badge--official">{text.card.official}</span> : null}
            {candidate?.fresh && !plugin.installedVersion ? <span className="plugin-badge" title={text.card.freshTitle}>{text.card.fresh}</span> : null}
          </div>
          <span className="plugin-dialog__sub" title={plugin.name}>{sub}</span>
        </div>
        <div className="plugin-dialog__head-actions">
          <span className="market-card__action">
            <PluginMarketCardAction plugin={plugin} {...handlers} />
          </span>
          <button className="plugin-icon-btn" type="button" aria-label={copy.close} title={copy.close} data-autofocus onClick={onClose}>
            <X size={15} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="plugin-dialog__body">
        {error ? <p className="plugin-callout plugin-callout--bad" role="alert">{error}</p> : null}
        {!details && !error ? <div className="plugin-page__summary"><LoaderCircle className="plugin-spin" size={13} strokeWidth={2.2} aria-hidden="true" />{copy.loading}</div> : null}
        {shots.length > 0 ? (
          <div className="market-shots" aria-label={copy.screenshots}>
            {shots.map((shot, index) => {
              const caption = localized(shot.caption, locale, "");
              return (
                <figure key={`${shot.url}-${index}`} className="market-shot">
                  <img src={shot.url} alt={caption ? "" : title} loading="lazy" />
                  {caption ? <figcaption>{caption}</figcaption> : null}
                </figure>
              );
            })}
          </div>
        ) : null}
        {details ? (
          <div className="market-detail">
            <div className="market-detail__main">
              <div className="plugin-tabs market-detail__tabs" role="tablist" aria-label={copy.tabsLabel} onKeyDown={onTabKey}>
                {TABS.map((item) => (
                  <button key={item} className="plugin-tabs__tab" type="button" role="tab" aria-selected={tab === item} tabIndex={tab === item ? 0 : -1} data-detail-tab={item} onClick={() => setTab(item)}>
                    {copy.tabs[item]}
                  </button>
                ))}
              </div>
              <div className="market-detail__panel" role="tabpanel">
                <PluginMarketDetailTabBody tab={tab} details={details} fallback={fallback} />
              </div>
            </div>
            <aside className="market-detail__aside">
              <dl>
                {info.filter(([, value]) => value).map(([label, value]) => (
                  <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                ))}
              </dl>
              {links.length > 0 ? (
                <div className="market-detail__links">
                  {links.map(({ key, url }) => (
                    <button key={key} className="plugin-btn plugin-btn--ghost plugin-btn--sm" type="button" data-market-link={key} onClick={() => openHttpUrl(url)}>
                      <ExternalLink size={12} strokeWidth={2.2} aria-hidden="true" />
                      {copy.links[key]}
                    </button>
                  ))}
                </div>
              ) : null}
            </aside>
          </div>
        ) : null}
      </div>
    </PluginMarketDialog>
  );
}
