import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { CloudOff, LoaderCircle, PowerOff, RefreshCw, ShieldCheck, Store, Upload } from "lucide-react";
import type { MarketCatalogPlugin, MarketCatalogSnapshot } from "@fuyu/plugin-services";
import type { PluginMarketSort } from "../../i18n/sections/settings/pluginMarket";
import { requestIslandPluginPage } from "../../features/plugin-kernel/api";
import { useLocale, useTranslation } from "../../i18n";
import type { SettingsCategory } from "./categories";
import { PluginMarketBrowse } from "./PluginMarketBrowse";
import { PluginMarketDetailModal } from "./PluginMarketDetailModal";
import { PluginMarketEmpty } from "./PluginMarketEmpty";
import { PluginMarketToolbar } from "./PluginMarketToolbar";
import { marketClient } from "./pluginMarketActions";
import { announceMarketPackage } from "./pluginMarketBus";
import { categoryCounts, formatMarketTime, localized, newListings } from "./pluginMarketModel";
import { usePluginFilePicker } from "./PluginPageActions";
import { requestPluginDetail, type OpenedPluginPackage } from "./pluginPageHandoff";
import { pluginPlaces } from "./pluginReach";
import { usePluginInstallFlow } from "./usePluginInstallFlow";
import { usePluginMarketPackage } from "./usePluginMarketPackage";
import "./PluginPage.css";
import "./InstalledPlugins.css";
import "./PluginMarket.css";

export type PluginMarketHost = "open" | "connecting" | "off";

export interface PluginMarketViewProps {
  host: PluginMarketHost;
  snapshot: MarketCatalogSnapshot | null;
  failure?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onReload?: () => void;
  onOpenPage?: (page: SettingsCategory) => void;
  initialQuery?: string;
  initialDetail?: string | null;
  openedPackage?: OpenedPluginPackage | null;
  openedError?: string | null;
  onConsumePackage?: (seq: number) => void;
}

export function PluginMarketView({ host, snapshot, failure = null, refreshing = false, onRefresh, onReload, onOpenPage, initialQuery = "", initialDetail = null, openedPackage, openedError, onConsumePackage }: PluginMarketViewProps) {
  const text = useTranslation().settings.pluginsV3.marketPage;
  const { locale } = useLocale();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<PluginMarketSort>("recommended");
  const [detailName, setDetailName] = useState<string | null>(initialDetail);
  const [packageError, setPackageError] = useState<string | null>(null);
  const plugins = snapshot?.plugins ?? [];
  const [openedAt] = useState(Date.now);
  const newNames = newListings(plugins, snapshot?.marketSince, openedAt);
  const flow = usePluginInstallFlow(onReload, snapshot ? { plugins, manualAllowed: snapshot.manualAllowed } : null);
  const file = usePluginFilePicker(announceMarketPackage);
  const offerFileRef = useRef(flow.offerFile);
  useLayoutEffect(() => {
    offerFileRef.current = flow.offerFile;
  });
  const offerPackage = useCallback(async (base64: string, fileName: string) => {
    const inspected = await marketClient.inspectPackage({ base64 });
    setPackageError(null);
    offerFileRef.current(inspected, base64, fileName);
  }, []);
  usePluginMarketPackage(host === "open", openedPackage, onConsumePackage, offerPackage, setPackageError);

  const categoryName = (id: string) => text.categories[id] ?? id;
  const nameOf = (id: string) => {
    const found = plugins.find((plugin) => plugin.name === id);
    return found ? localized(found.displayName, locale, id) : id;
  };
  const islandPages = new Set((snapshot?.installed ?? []).filter((item) => item.enabled && pluginPlaces(item.reach, null).includes("page")).map((item) => item.id));
  const handlers = {
    onOpen: (plugin: MarketCatalogPlugin) => setDetailName(plugin.name),
    onInstall: (plugin: MarketCatalogPlugin) => {
      setDetailName(null);
      flow.offer(plugin);
    },
    onManage: onOpenPage
      ? (plugin: MarketCatalogPlugin) => {
          requestPluginDetail(plugin.name);
          onOpenPage("pluginsV3");
        }
      : undefined,
    onGoUpdate: onOpenPage ? () => onOpenPage("about") : undefined,
    canOpenOnIsland: (plugin: MarketCatalogPlugin) => plugin.enabled && !plugin.revoked && islandPages.has(plugin.name),
    onOpenOnIsland: (plugin: MarketCatalogPlugin) => void requestIslandPluginPage(plugin.name).catch((error: unknown) => console.error(`Failed to open ${plugin.name} on the island`, error)),
  };
  const pickCategory = (id: string | null) => {
    setQuery("");
    setCategory((current) => (current === id ? null : id));
  };
  const detailPlugin = detailName ? plugins.find((plugin) => plugin.name === detailName) ?? null : null;
  const marketError = failure ?? snapshot?.error ?? null;
  const shownError = packageError ?? openedError ?? null;
  const installed = snapshot ? snapshot.installed.length || plugins.filter((plugin) => plugin.installedVersion).length : 0;
  const time = snapshot?.updatedAt ? formatMarketTime(snapshot.updatedAt, locale) : null;
  const retry = onRefresh ? (
    <button className="plugin-btn plugin-btn--sm" type="button" disabled={refreshing} data-action="market-retry" onClick={onRefresh}>
      <RefreshCw className={refreshing ? "plugin-spin" : undefined} size={13} strokeWidth={2.2} aria-hidden="true" />
      {text.error.retry}
    </button>
  ) : null;
  const fileButton = (
    <button className="plugin-btn plugin-btn--sm" type="button" data-action="market-install-file" onClick={file.pick}>
      <Upload size={13} strokeWidth={2.2} aria-hidden="true" />
      {text.installFromFile}
    </button>
  );

  let body;
  if (host === "off") {
    body = (
      <PluginMarketEmpty kind="offline" icon={<PowerOff size={22} strokeWidth={1.8} />} title={text.offline.title} body={text.offline.body}>
        {onOpenPage ? <button className="plugin-btn plugin-btn--sm" type="button" onClick={() => onOpenPage("pluginsV3")}>{text.offline.openPlugins}</button> : null}
      </PluginMarketEmpty>
    );
  } else if (host === "connecting" || (!snapshot && !failure)) {
    body = (
      <>
        <div className="plugin-page__summary"><LoaderCircle className="plugin-spin" size={13} strokeWidth={2.2} aria-hidden="true" />{text.loading}</div>
        <PluginMarketToolbar query="" category={null} sort={sort} total={0} categories={[]} categoryName={categoryName} disabled onQuery={() => undefined} onCategory={() => undefined} onSort={() => undefined} />
        <div className="market-grid" aria-busy="true" data-market-loading>
          {[46, 38, 52, 30, 44, 36].map((width) => (
            <div key={width} className="market-card market-card--skeleton">
              <div className="market-card__head">
                <span className="plugin-icon" />
                <div className="market-card__title"><span className="plugin-skeleton" style={{ width: `${width}%` }} /><span className="plugin-skeleton plugin-skeleton--thin" style={{ width: `${width - 14}%` }} /></div>
              </div>
              <span className="plugin-skeleton plugin-skeleton--thin" style={{ width: "90%" }} />
              <span className="plugin-skeleton plugin-skeleton--thin" style={{ width: "60%" }} />
            </div>
          ))}
        </div>
      </>
    );
  } else if (plugins.length === 0 && marketError) {
    body = (
      <PluginMarketEmpty kind="error" icon={<CloudOff size={22} strokeWidth={1.8} />} title={text.error.title} body={text.error.body} detail={marketError}>
        {retry}
        {fileButton}
      </PluginMarketEmpty>
    );
  } else if (plugins.length === 0) {
    body = (
      <PluginMarketEmpty kind="empty-index" icon={<Store size={22} strokeWidth={1.8} />} title={text.emptyIndex.title} body={text.emptyIndex.body}>
        {onRefresh ? <button className="plugin-btn plugin-btn--sm plugin-btn--primary" type="button" disabled={refreshing} onClick={onRefresh}>{text.refresh}</button> : null}
        {fileButton}
      </PluginMarketEmpty>
    );
  } else {
    body = (
      <>
        {marketError ? (
          <section className="plugin-banner plugin-banner--warn" data-market-cached>
            <span className="plugin-banner__icon"><CloudOff size={16} strokeWidth={2.2} aria-hidden="true" /></span>
            <div className="plugin-banner__title">{text.error.cachedTitle}</div>
            <div className="plugin-banner__body">{text.error.cachedBody(time)}</div>
            {retry ? <div className="plugin-banner__actions">{retry}</div> : null}
          </section>
        ) : null}
        <div className="plugin-page__summary market-meta">
          <b>{text.count(plugins.length)}</b>
          {time ? <span>{marketError ? text.cachedAt(time) : text.indexUpdated(time)}</span> : null}
          {onOpenPage && installed > 0 ? <button className="plugin-link" type="button" data-action="market-installed" onClick={() => onOpenPage("pluginsV3")}>{text.installedLink(installed)}</button> : null}
        </div>
        <PluginMarketToolbar query={query} category={category} sort={sort} total={plugins.length} categories={categoryCounts(plugins)} categoryName={categoryName} onQuery={setQuery} onCategory={pickCategory} onSort={setSort} />
        <PluginMarketBrowse plugins={plugins} newNames={newNames} query={query} category={category} sort={sort} categoryName={categoryName} handlers={handlers} onCategory={pickCategory} onInstallFile={file.pick} />
        <p className="plugin-foot market-trust"><ShieldCheck size={13} strokeWidth={2.2} aria-hidden="true" />{text.trustLine}</p>
      </>
    );
  }

  return (
    <div className="plugin-page market-page" data-market-page>
      {shownError ? <p className="plugin-callout plugin-callout--bad" role="alert">{shownError}</p> : null}
      {body}
      {file.input}
      {detailPlugin ? <PluginMarketDetailModal plugin={detailPlugin} isNew={newNames.has(detailPlugin.name)} categoryName={categoryName} nameOf={nameOf} onClose={() => setDetailName(null)} onInstall={handlers.onInstall} onManage={handlers.onManage} onGoUpdate={handlers.onGoUpdate} canOpenOnIsland={handlers.canOpenOnIsland} onOpenOnIsland={handlers.onOpenOnIsland} /> : null}
      {flow.modal}
    </div>
  );
}
