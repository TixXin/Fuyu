import { useCallback, useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Search, X } from "lucide-react";
import { useErrorText, useTranslation } from "../../i18n";
import { onPluginPackageOpen, takePendingPluginPackage, type BuiltinPlugin } from "../../features/plugin-kernel/api";
import { useBuiltinPlugins } from "../../features/plugin-kernel/useBuiltinPlugins";
import { BuiltinPluginsGroup, isExternalPlugin, stateOf } from "./BuiltinPluginsGroup";
import type { SettingsCategory } from "./categories";
import { PluginBisectBar } from "./PluginBisectBar";
import { PluginDetailModal } from "./PluginDetailModal";
import { HostSummaryBar, megabytes, PluginDiagnosticsTab } from "./PluginDiagnosticsTab";
import { PluginMarketV3Tab, type OpenedPluginPackage } from "./PluginMarketV3Tab";
import { V2PluginMigrationCard } from "./V2PluginMigrationCard";
import { usePluginHostEnabled, usePluginHostStatus, type PluginHostConnector, type PluginHostView } from "./usePluginHostStatus";
import "./PluginsV3SettingsPage.css";

export type PluginsV3Tab = "plugins" | "market" | "diagnostics";

const TAB_ORDER: readonly PluginsV3Tab[] = ["plugins", "market", "diagnostics"];

function SearchInput({ query, onChange }: { query: string; onChange: (next: string) => void }) {
  const text = useTranslation().settings.pluginsV3;
  return (
    <label className="plugins-v3__search">
      <Search size={13} strokeWidth={2.2} aria-hidden="true" />
      <input
        type="search"
        value={query}
        placeholder={text.searchPlaceholder}
        aria-label={text.searchPlaceholder}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && query) {
            event.preventDefault();
            onChange("");
          }
        }}
      />
      {query ? (
        <button className="plugins-v3__search-clear" type="button" aria-label={text.closeDetail} onClick={() => onChange("")}>
          <X size={12} strokeWidth={2.2} aria-hidden="true" />
        </button>
      ) : null}
    </label>
  );
}

let bufferedPackage: OpenedPluginPackage | null = null;
let inFlightPackage: Promise<{ pkg: OpenedPluginPackage | null; error: string | null }> | null = null;
let nextPackageSeq = 0;

function consumeBufferedPackage(seq: number) {
  if (bufferedPackage?.seq === seq) bufferedPackage = null;
}

function pullPendingPackage(formatError: (error: unknown) => string): Promise<{ pkg: OpenedPluginPackage | null; error: string | null }> {
  if (inFlightPackage) return inFlightPackage;
  inFlightPackage = takePendingPluginPackage()
    .then((taken) => {
      if (taken) {
        nextPackageSeq += 1;
        bufferedPackage = { seq: nextPackageSeq, fileName: taken.fileName, base64: taken.base64 };
      }
      return { pkg: bufferedPackage, error: null };
    })
    .catch((failure: unknown) => ({ pkg: null, error: formatError(failure) }))
    .finally(() => {
      inFlightPackage = null;
    });
  return inFlightPackage;
}

export function PluginsV3View({ view, now = Date.now(), builtins: givenBuiltins, onOpenPage }: {
  view: PluginHostView;
  now?: number;
  builtins?: readonly BuiltinPlugin[] | null;
  onOpenPage?: (page: SettingsCategory) => void;
}) {
  const text = useTranslation().settings.pluginsV3;
  const errorText = useErrorText();
  const loadedBuiltins = useBuiltinPlugins();
  const builtins = givenBuiltins === undefined ? loadedBuiltins : givenBuiltins;
  const [tab, setTab] = useState<PluginsV3Tab>("plugins");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openedPackage, setOpenedPackage] = useState<OpenedPluginPackage | null>(null);
  const [openedError, setOpenedError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    const syncPending = () => {
      void pullPendingPackage(errorText).then(({ pkg, error }) => {
        if (cancelled) return;
        if (pkg) {
          setOpenedError(null);
          setOpenedPackage(pkg);
          setTab("market");
        } else if (error) {
          setOpenedError(error);
          setTab("market");
        }
      });
    };
    syncPending();
    void onPluginPackageOpen(syncPending)
      .then((unlisten) => {
        if (cancelled) unlisten();
        else stop = unlisten;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [errorText]);

  const handleConsumeOpenedPackage = useCallback((seq: number) => {
    consumeBufferedPackage(seq);
    setOpenedPackage((prev) => (prev?.seq === seq ? null : prev));
  }, []);

  const { host, plugins, connection, memory } = view;
  const measured = memory && host && memory.pid === host.pid ? memory : null;
  const open = connection === "open";
  const builtinIds = new Set(builtins?.map((item) => item.id) ?? []);
  const extras = (plugins ?? []).filter((item) => isExternalPlugin(item, builtinIds));
  const installedCount = extras.length;
  const hostById = new Map((plugins ?? []).map((item) => [item.id, item]));
  const runningCount = extras.filter((p) => stateOf(p) === "running").length;
  const selectedBuiltin = builtins?.find((b) => b.id === selectedId);
  const selectedHost = selectedId ? hostById.get(selectedId) : undefined;
  const showHostNotice = !open || Boolean(host?.safe);

  const switchTabKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const index = TAB_ORDER.indexOf(tab);
    const delta = event.key === "ArrowRight" ? 1 : TAB_ORDER.length - 1;
    const next = TAB_ORDER[(index + delta) % TAB_ORDER.length];
    setTab(next);
    const parent = event.currentTarget;
    requestAnimationFrame(() => parent.querySelector<HTMLButtonElement>(`[data-tab='${next}']`)?.focus());
  };

  return (
    <>
      <div className="plugins-v3__tabs-bar">
        <div className="plugins-v3__tabs" role="tablist" onKeyDown={switchTabKey}>
          <button
            className={`plugins-v3__tab${tab === "plugins" ? " plugins-v3__tab--active" : ""}`}
            type="button"
            role="tab"
            tabIndex={tab === "plugins" ? 0 : -1}
            aria-selected={tab === "plugins"}
            data-tab="plugins"
            onClick={() => setTab("plugins")}
          >
            <span>{text.tabs.plugins(installedCount)}</span>
          </button>
          <button
            className={`plugins-v3__tab${tab === "market" ? " plugins-v3__tab--active" : ""}`}
            type="button"
            role="tab"
            tabIndex={tab === "market" ? 0 : -1}
            aria-selected={tab === "market"}
            data-tab="market"
            onClick={() => setTab("market")}
          >
            <span>{text.tabs.market}</span>
          </button>
          <button
            className={`plugins-v3__tab${tab === "diagnostics" ? " plugins-v3__tab--active" : ""}`}
            type="button"
            role="tab"
            tabIndex={tab === "diagnostics" ? 0 : -1}
            aria-selected={tab === "diagnostics"}
            data-tab="diagnostics"
            onClick={() => setTab("diagnostics")}
          >
            <span className={`plugins-v3__tab-dot plugins-v3__tab-dot--${connection}`} />
            <span>{text.tabs.diagnostics}</span>
            {open && host ? <span className="plugins-v3__tab-pill">{megabytes(measured ? measured.bytes : host.rssBytes)}</span> : null}
          </button>
        </div>
        <SearchInput query={query} onChange={setQuery} />
      </div>

      {tab === "plugins" ? (
        <>
          {showHostNotice ? (
            <HostSummaryBar view={view} runningCount={runningCount} showRunning={installedCount > 0} onOpenDiagnostics={() => setTab("diagnostics")} />
          ) : null}
          <V2PluginMigrationCard onOpenMarketTab={() => setTab("market")} />
          {open ? <PluginBisectBar thirdPartyIds={extras.map((p) => p.id)} onBisect={view.bisect} /> : null}
          <BuiltinPluginsGroup builtins={builtins} hostPlugins={plugins} hostEnabled={true} stale={!open} query={query} onSelectPlugin={setSelectedId} onOpenMarketTab={() => setTab("market")} />
        </>
      ) : tab === "market" ? (
        <PluginMarketV3Tab connected={open} query={query} openedPackage={openedPackage} openedError={openedError} onConsumeOpenedPackage={handleConsumeOpenedPackage} />
      ) : (
        <PluginDiagnosticsTab view={view} now={now} builtins={builtins} hostPlugins={plugins} query={query} onSelectPlugin={setSelectedId} />
      )}

      {selectedId ? <PluginDetailModal builtin={selectedBuiltin} hostPlugin={selectedHost} hostPlugins={plugins} builtins={builtins} onClose={() => setSelectedId(null)} onOpenPage={onOpenPage} /> : null}
    </>
  );
}

function HostConnectedPage({ connect, builtins, onOpenPage }: { connect?: PluginHostConnector; builtins: readonly BuiltinPlugin[] | null; onOpenPage?: (page: SettingsCategory) => void }) {
  const view = usePluginHostStatus(connect);
  return <PluginsV3View view={view} builtins={builtins} onOpenPage={onOpenPage} />;
}

export function PluginsV3SettingsPage({ connect, onOpenPage }: { connect?: PluginHostConnector; onOpenPage?: (page: SettingsCategory) => void }) {
  const text = useTranslation().settings.pluginsV3;
  const hostEnabled = usePluginHostEnabled();
  const builtins = useBuiltinPlugins();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedBuiltin = builtins?.find((b) => b.id === selectedId);
  return (
    <div className="plugins-v3">
      {hostEnabled === true ? <HostConnectedPage connect={connect} builtins={builtins} onOpenPage={onOpenPage} /> : null}
      {hostEnabled === false ? (
        <>
          <div className="plugins-v3__tabs-bar">
            <div className="plugins-v3__tabs" role="tablist">
              <button className="plugins-v3__tab plugins-v3__tab--active" type="button" role="tab" aria-selected={true} data-tab="plugins">
                <span>{text.tabs.plugins(0)}</span>
              </button>
            </div>
            <SearchInput query={query} onChange={setQuery} />
          </div>
          <section className="plugins-v3__host-bar settings-group" aria-label={text.host}>
            <div className="plugins-v3__host-bar-row">
              <div className="plugins-v3__host-bar-left">
                <span className="plugins-v3__connection plugins-v3__connection--closed" data-connection="off">{text.hostOff}</span>
                <span className="plugins-v3__dock-note">{text.hostOffNote}</span>
              </div>
            </div>
          </section>
          <V2PluginMigrationCard />
          <BuiltinPluginsGroup builtins={builtins} hostEnabled={false} query={query} onSelectPlugin={setSelectedId} />
          {selectedId ? <PluginDetailModal builtin={selectedBuiltin} onClose={() => setSelectedId(null)} onOpenPage={onOpenPage} /> : null}
        </>
      ) : null}
      {hostEnabled === null ? <BuiltinPluginsGroup builtins={builtins} hostEnabled={null} query={query} onSelectPlugin={setSelectedId} /> : null}
    </div>
  );
}
