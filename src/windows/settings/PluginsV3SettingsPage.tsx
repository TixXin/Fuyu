import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useErrorText, useLocale, useTranslation } from "../../i18n";
import { onPluginPackageOpen, setBuiltinPluginEnabled, type BuiltinPlugin, type HostNodeStatus } from "../../features/plugin-kernel/api";
import { useBuiltinPlugins } from "../../features/plugin-kernel/useBuiltinPlugins";
import type { SettingsCategory } from "./categories";
import type { RowAction } from "./InstalledPluginRow";
import { InstalledPluginList } from "./InstalledPluginList";
import { InstalledPluginSuggestions } from "./InstalledPluginSuggestions";
import { InstalledPluginsEmpty } from "./InstalledPluginsEmpty";
import { PluginBarUsage } from "./PluginBarUsage";
import { PluginDetailModal } from "./PluginDetailModal";
import { installedEntries, type InstalledEntry, type InstalledFilter } from "./pluginEntries";
import { restartPlugin } from "./pluginMarketActions";
import { PluginPageBanners } from "./PluginPageBanners";
import { usePluginSectionOwners } from "./PluginSettingsSections";
import { usePluginFilePicker } from "./PluginPageActions";
import { onPluginDetailRequest, pullPendingPackage, requestMarketView, takePluginDetailRequest, type PluginDetailRequest, type PluginDetailTab } from "./pluginPageHandoff";
import { usePluginBarUsage, type BarUsageView } from "./usePluginBarUsage";
import { usePluginHostNode } from "./usePluginHostNode";
import { usePluginHostEnabled, usePluginHostStatus, type PluginHostConnector, type PluginHostView } from "./usePluginHostStatus";
import { usePluginInstallFlow } from "./usePluginInstallFlow";
import { usePluginMarketCatalog } from "./usePluginMarketCatalog";
import { V2PluginMigrationCard } from "./V2PluginMigrationCard";
import "./PluginPage.css";
import "./InstalledPlugins.css";

interface OpenDetail {
  id: string;
  tab: PluginDetailTab;
  uninstall: boolean;
  request?: PluginDetailRequest;
  nonce?: number;
}

const OFF_VIEW: PluginHostView = { connection: "closed", plugins: [], host: null, memory: null, safeMode: null };
const LOADING_VIEW: PluginHostView = { ...OFF_VIEW, connection: "connecting", plugins: null };

function usePackageRedirect(onOpenPage?: (page: SettingsCategory) => void) {
  const errorText = useErrorText();
  useEffect(() => {
    if (!onOpenPage) return;
    let cancelled = false;
    let stop: (() => void) | null = null;
    const sync = () =>
      void pullPendingPackage(errorText).then(({ pkg, error }) => {
        if (!cancelled && (pkg || error)) onOpenPage("pluginMarket");
      });
    sync();
    void onPluginPackageOpen(sync)
      .then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)))
      .catch(() => undefined);
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [errorText, onOpenPage]);
}

export function PluginsV3View({ view, hostOff = false, node: givenNode, builtins: givenBuiltins, initialDetail = null, barUsage, onBarChanged, onOpenPage }: {
  view: PluginHostView;
  hostOff?: boolean;
  barUsage?: BarUsageView;
  onBarChanged?: () => void;
  initialDetail?: PluginDetailRequest | null;
  node?: HostNodeStatus | null;
  builtins?: readonly BuiltinPlugin[] | null;
  onOpenPage?: (page: SettingsCategory) => void;
}) {
  const text = useTranslation().settings.pluginsV3.page;
  const { locale } = useLocale();
  const loadedBuiltins = useBuiltinPlugins();
  const builtins = givenBuiltins === undefined ? loadedBuiltins : givenBuiltins;
  const live = !hostOff && view.connection === "open";
  const watched = usePluginHostNode(!hostOff && givenNode === undefined && view.connection !== "open");
  const node = givenNode === undefined ? watched.node : givenNode;
  const catalog = usePluginMarketCatalog(live);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InstalledFilter>("all");
  const [detail, setDetail] = useState<OpenDetail | null>(initialDetail ? { ...initialDetail, uninstall: false, request: initialDetail } : null);
  const install = usePluginInstallFlow(catalog.reload, undefined, {
    plugins: hostOff ? null : view.plugins,
    onOpenSettings: (id) => setDetail({ id, tab: "settings", uninstall: false }),
  });
  useEffect(() => {
    if (initialDetail) setDetail((current) => (current?.request === initialDetail ? current : { ...initialDetail, uninstall: false, request: initialDetail, nonce: (current?.nonce ?? 0) + 1 }));
  }, [initialDetail]);
  const [actionError, setActionError] = useState<string | null>(null);
  const errorText = useErrorText();
  const file = usePluginFilePicker(() => onOpenPage?.("pluginMarket"));

  const runtime = node?.state === "downloading" || node?.state === "checking" ? "downloading" : node?.state === "failed" ? "failed" : "ready";
  const builtinIds = new Set(builtins?.map((item) => item.id) ?? []);
  const sectionOwners = usePluginSectionOwners();
  const entries = installedEntries(hostOff ? [] : view.plugins, builtinIds, catalog.snapshot, { live, runtime, builtins }, locale, sectionOwners);
  const stale = !live;
  const selected = detail ? entries.find((entry) => entry.id === detail.id) ?? null : null;

  const openMarket = (request?: { detail?: string; query?: string }) => {
    if (request) requestMarketView(request);
    onOpenPage?.("pluginMarket");
  };
  const fail = (failure: unknown) => setActionError(errorText(failure));

  const act = (entry: InstalledEntry, action: RowAction) => {
    setActionError(null);
    switch (action) {
      case "restart":
        return void restartPlugin(entry.id).catch(fail);
      case "log":
        return setDetail({ id: entry.id, tab: "activity", uninstall: false });
      case "uninstall":
        return setDetail({ id: entry.id, tab: "overview", uninstall: true });
      case "turnOnProvider": {
        const provider = entry.status.note?.kind === "waiting" ? entry.status.note.provider : null;
        return void (provider ? setBuiltinPluginEnabled(provider, true).catch(fail) : undefined);
      }
      case "update":
        return entry.market ? install.offer(entry.market) : undefined;
      case "review":
      case "whatsNew":
        setDetail(null);
        return openMarket({ detail: entry.id });
    }
  };

  const loading = !hostOff && view.plugins === null;
  return (
    <div className="plugin-page" data-plugin-page={hostOff ? "off" : view.connection}>
      <V2PluginMigrationCard onOpenMarket={onOpenPage ? (name) => openMarket(name ? { detail: name } : undefined) : undefined} />
      <PluginPageBanners
        view={view}
        hostOff={hostOff}
        node={node}
        onRetryNode={watched.retry}
        entries={entries}
        onOpenDiagnostics={() => onOpenPage?.("pluginDiagnostics")}
        onOnlyAttention={() => setFilter("attention")}
        onOpenMarket={onOpenPage ? (name) => openMarket({ detail: name }) : undefined}
      />
      {actionError ? <p className="plugin-callout plugin-callout--bad" role="alert">{actionError}</p> : null}
      {loading && runtime === "failed" ? null : loading ? (
        <>
          <div className="plugin-page__summary"><LoaderCircle className="plugin-spin" size={13} strokeWidth={2.2} aria-hidden="true" />{text.loading}</div>
          <div className="plugin-list" aria-busy="true">
            {[28, 36, 22].map((width) => (
              <div key={width} className="plugin-row plugin-row--skeleton">
                <span className="plugin-icon" />
                <div className="plugin-row__main">
                  <span className="plugin-skeleton" style={{ width: `${width}%` }} />
                  <span className="plugin-skeleton plugin-skeleton--thin" style={{ width: `${width + 25}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : entries.length === 0 && !hostOff ? (
        <InstalledPluginsEmpty snapshot={catalog.snapshot} onBrowse={() => openMarket()} onInstallFile={file.pick} onInstall={install.offer} />
      ) : entries.length > 0 ? (
        <>
          <InstalledPluginList
          entries={entries}
          stale={stale}
          query={query}
          filter={filter}
          onQuery={setQuery}
          onFilter={setFilter}
          onOpen={(entry, tab = "overview") => setDetail({ id: entry.id, tab, uninstall: false })}
          onAction={act}
          onSearchMarket={() => openMarket({ query })}
          />
          <PluginBarUsage entries={entries} usage={stale ? undefined : barUsage} onOpenSettings={(id) => setDetail({ id, tab: "settings", uninstall: false })} onChanged={onBarChanged} />
          <InstalledPluginSuggestions snapshot={catalog.snapshot} onBrowse={() => openMarket()} onInstall={install.offer} />
        </>
      ) : null}
      <p className="plugin-foot" data-footnote>
        {text.footnote.before}
        <button className="plugin-link" type="button" data-action="open-overview" onClick={() => onOpenPage?.("overview")}>{text.footnote.link}</button>
        {text.footnote.after}
      </p>
      {file.input}
      {selected && detail ? (
        <PluginDetailModal
          key={`${selected.id}:${detail.tab}:${detail.uninstall}:${detail.nonce ?? 0}`}
          entry={selected}
          initialTab={detail.tab}
          startUninstall={detail.uninstall}
          stale={stale}
          onClose={() => setDetail(null)}
          onAction={(action) => act(selected, action)}
          onOpenShortcuts={onOpenPage ? () => onOpenPage("shortcuts") : undefined}
        />
      ) : null}
      {install.modal}
    </div>
  );
}

function HostConnectedPage({ connect, initialDetail, onOpenPage }: { connect?: PluginHostConnector; initialDetail: PluginDetailRequest | null; onOpenPage?: (page: SettingsCategory) => void }) {
  const view = usePluginHostStatus(connect);
  const bar = usePluginBarUsage(view.connection === "open");
  return <PluginsV3View view={view} initialDetail={initialDetail} barUsage={bar.usage} onBarChanged={bar.refresh} onOpenPage={onOpenPage} />;
}

export function PluginsV3SettingsPage({ connect, onOpenPage }: { connect?: PluginHostConnector; onOpenPage?: (page: SettingsCategory) => void }) {
  const hostEnabled = usePluginHostEnabled();
  const [initialDetail, setInitialDetail] = useState(takePluginDetailRequest);
  useEffect(
    () =>
      onPluginDetailRequest(() => {
        const request = takePluginDetailRequest();
        if (request) setInitialDetail(request);
      }),
    [],
  );
  usePackageRedirect(onOpenPage);
  if (hostEnabled === null) return <PluginsV3View view={LOADING_VIEW} node={null} onOpenPage={onOpenPage} />;
  return hostEnabled ? <HostConnectedPage connect={connect} initialDetail={initialDetail} onOpenPage={onOpenPage} /> : <PluginsV3View view={OFF_VIEW} hostOff node={null} onOpenPage={onOpenPage} />;
}

