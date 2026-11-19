import { useState, type MouseEvent } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import type { MarketCatalogPlugin } from "@fuyu/plugin-services";
import { useLocale, useTranslation } from "../../i18n";
import { MarketImage } from "./MarketImage";
import { OfficialMark } from "./OfficialMark";
import { iconSources } from "./pluginIconSources";
import { PluginLogo } from "./PluginLogo";
import { hasUpdate, localized, offeredCandidate } from "./pluginMarketModel";
import { marketActionCandidate } from "./pluginRowStatus";

export interface MarketCardHandlers {
  onOpen: (plugin: MarketCatalogPlugin) => void;
  onInstall: (plugin: MarketCatalogPlugin) => void;
  onManage?: (plugin: MarketCatalogPlugin) => void;
  onGoUpdate?: () => void;
  canOpenOnIsland?: (plugin: MarketCatalogPlugin) => boolean;
  onOpenOnIsland?: (plugin: MarketCatalogPlugin) => void;
}

export function PluginMarketCardAction({ plugin, onInstall, onManage, onGoUpdate, canOpenOnIsland, onOpenOnIsland }: Omit<MarketCardHandlers, "onOpen"> & { plugin: MarketCatalogPlugin }) {
  const { locale } = useLocale();
  const text = useTranslation().settings.pluginsV3.marketPage.card;
  const stop = (event: MouseEvent, run: () => void) => {
    event.stopPropagation();
    run();
  };
  if (plugin.blocked && !plugin.installedVersion) {
    if (plugin.blocked.reason === "platform") return <span className="market-card__blocked">{text.platform}</span>;
    return (
      <>
        <span className="market-card__blocked">{plugin.blocked.range ? text.needsFuyu(plugin.blocked.range) : text.needsNewerFuyu}</span>
        {onGoUpdate ? <button className="plugin-btn plugin-btn--sm" type="button" data-action="market-go-update" onClick={(event) => stop(event, onGoUpdate)}>{text.goUpdate}</button> : null}
      </>
    );
  }
  const action = marketActionCandidate(plugin);
  if (hasUpdate(plugin) && action) {
    return <button className="plugin-btn plugin-btn--sm plugin-btn--primary" type="button" data-action="market-update" onClick={(event) => stop(event, () => onInstall(plugin))}>{text.update(action.candidate.version)}</button>;
  }
  if (plugin.installedVersion) {
    return (
      <>
        <span className="market-card__installed"><Check size={13} strokeWidth={2.4} aria-hidden="true" />{text.installed}</span>
        {onManage ? <button className="plugin-btn plugin-btn--sm" type="button" data-action="market-manage" onClick={(event) => stop(event, () => onManage(plugin))}>{text.manage}</button> : null}
        {onOpenOnIsland && canOpenOnIsland?.(plugin) ? (
          <button className="plugin-btn plugin-btn--sm market-card__island" type="button" data-action="market-open-on-island" title={text.openOnIslandTitle(localized(plugin.displayName, locale, plugin.name))} aria-label={text.openOnIsland} onClick={(event) => stop(event, () => onOpenOnIsland(plugin))}>
            <ArrowUpRight size={13} strokeWidth={2.2} aria-hidden="true" />
            <span className="market-card__island-label">{text.openOnIsland}</span>
          </button>
        ) : null}
      </>
    );
  }
  if (plugin.revoked) return <span className="market-card__blocked market-card__blocked--bad">{text.revoked}</span>;
  if (!action) return <span className="market-card__blocked">{text.unavailable}</span>;
  return <button className="plugin-btn plugin-btn--sm plugin-btn--primary" type="button" data-action="market-install" onClick={(event) => stop(event, () => onInstall(plugin))}>{text.install}</button>;
}

function MarketCardThumb({ plugin, onFail }: { plugin: MarketCatalogPlugin; onFail: () => void }) {
  const text = useTranslation().settings.pluginsV3.marketPage.card;
  const shots = plugin.screenshots ?? [];
  return (
    <div className="market-card__thumb" data-market-thumb={shots.length}>
      <MarketImage url={shots[0].url} lazy alt="" draggable={false} onError={onFail} />
      {shots.length > 1 ? <span className="market-card__thumb-count">{text.shotCount(shots.length)}</span> : null}
    </div>
  );
}

export function PluginMarketCard({ plugin, categoryName, isNew = false, ...handlers }: MarketCardHandlers & { plugin: MarketCatalogPlugin; categoryName: (id: string) => string; isNew?: boolean }) {
  const { locale } = useLocale();
  const text = useTranslation().settings.pluginsV3.marketPage.card;
  const title = localized(plugin.displayName, locale, plugin.name);
  const description = localized(plugin.description, locale, "");
  const candidate = offeredCandidate(plugin);
  const version = candidate?.version ?? plugin.installedVersion;
  const [thumbFailed, setThumbFailed] = useState(false);
  const thumbed = !thumbFailed && (plugin.screenshots?.length ?? 0) > 0;
  const sub = [plugin.official ? null : plugin.publisher.github, plugin.categories[0] ? categoryName(plugin.categories[0]) : null, version ? `v${version}` : null].filter(Boolean).join(" · ");
  return (
    <article className={thumbed ? "market-card market-card--thumbed" : "market-card"} data-market-plugin={plugin.name} onClick={(event) => !(event.target as Element).closest("button") && handlers.onOpen(plugin)}>
      <div className="market-card__main">
        <div className="market-card__head">
          <PluginLogo sources={iconSources(plugin.icon)} title={title} />
          <div className="market-card__title">
            <div className="market-card__line">
              <button className="market-card__name" type="button" title={title} onClick={() => handlers.onOpen(plugin)}>{title}</button>
              {plugin.official ? <OfficialMark /> : null}
              {isNew ? <span className="plugin-badge plugin-badge--new" title={text.isNewTitle} data-new="true">{text.isNew}</span> : null}
              {plugin.revoked && plugin.installedVersion ? <span className="plugin-badge market-badge--bad">{text.revoked}</span> : null}
            </div>
            {sub ? <span className="market-card__sub">{sub}</span> : null}
          </div>
        </div>
        {description ? <p className="market-card__desc">{description}</p> : null}
      </div>
      {thumbed ? <MarketCardThumb plugin={plugin} onFail={() => setThumbFailed(true)} /> : null}
      <div className="market-card__foot">
        <span className="market-card__facts">
          {candidate ? (candidate.confirmation.network.length > 0 ? text.network : text.noNetwork) : null}
        </span>
        <span className="market-card__action">
          <PluginMarketCardAction plugin={plugin} onInstall={handlers.onInstall} onManage={handlers.onManage} onGoUpdate={handlers.onGoUpdate} canOpenOnIsland={handlers.canOpenOnIsland} onOpenOnIsland={handlers.onOpenOnIsland} />
        </span>
      </div>
    </article>
  );
}
