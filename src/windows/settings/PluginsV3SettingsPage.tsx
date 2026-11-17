import { useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Blocks, Search, X, type LucideIcon } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { BuiltinPluginName } from "../../i18n/sections/settings/pluginsV3";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { exitPluginSafeMode, type BuiltinPlugin } from "../../features/plugin-kernel/api";
import { useBuiltinPlugins } from "../../features/plugin-kernel/useBuiltinPlugins";
import { BUILTIN_ICONS, BuiltinPluginsGroup, matchesPluginQuery, milliseconds, PluginDetailModal, stateOf, TONES } from "./BuiltinPluginsGroup";
import { PluginHostNodeRow } from "./PluginHostNodeRow";
import { usePluginHostEnabled, usePluginHostStatus, type PluginHostConnector, type PluginHostView, type PluginStatusV3 } from "./usePluginHostStatus";
import "./PluginsV3SettingsPage.css";

type PluginsV3Tab = "plugins" | "diagnostics";

function megabytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function duration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${seconds % 60}s` : `${seconds}s`;
}

function SafeModeBanner({ view, mode }: { view: PluginHostView; mode: "third-party" | "minimal" }) {
  const text = useTranslation().settings.pluginsV3;
  const [leaving, setLeaving] = useState(false);
  const safe = view.safeMode?.mode === mode ? view.safeMode : null;
  const cause = safe === null ? undefined : safe.cause === "failures" ? text.safeCauses.failures(safe.failures) : text.safeCauses[safe.cause];
  const canLeave = safe !== null && safe.cause !== "variable";
  const leave = () => {
    setLeaving(true);
    void exitPluginSafeMode().catch(() => setLeaving(false));
  };
  return (
    <div className="plugins-v3__safe">
      <div className="plugins-v3__safe-text">
        <strong>{`${text.safeMode} · ${text.safeModes[mode]}`}</strong>
        {cause ? <span>{cause}</span> : null}
      </div>
      {canLeave ? <button className="plugins-v3__leave" type="button" disabled={leaving} onClick={leave}>{text.leaveSafeMode}</button> : null}
    </div>
  );
}

function HostSummaryBar({ view, runningCount, onOpenDiagnostics }: { view: PluginHostView; runningCount: number; onOpenDiagnostics: () => void }) {
  const text = useTranslation().settings.pluginsV3;
  const { host, connection, memory } = view;
  const measured = memory && host && memory.pid === host.pid ? memory : null;
  const open = connection === "open";
  const memoryKey = measured?.measure ?? "rss";
  return (
    <section className={`plugins-v3__host-bar settings-group${open && host?.safe ? " plugins-v3__dock--safe" : ""}`} aria-label={text.host}>
      <div className="plugins-v3__host-bar-row">
        <div className="plugins-v3__host-bar-left">
          <span className={`plugins-v3__connection plugins-v3__connection--${connection}`} data-connection={connection}>{text.connection[connection]}</span>
          {open && host ? (
            <>
              <span className="plugins-v3__host-meta">{text.hostDetail(host.pid, host.node)}</span>
              <span className="plugins-v3__host-meta" title={text.memoryNotes[memoryKey]}>
                {text.memoryTitles[memoryKey]}{" "}
                <strong className="plugins-v3__value" data-measure={memoryKey}>{megabytes(measured ? measured.bytes : host.rssBytes)}</strong>
              </span>
              <span className="plugins-v3__host-meta">{text.runningSummary(runningCount)}</span>
              {host.dev ? <span className="plugins-v3__badge plugins-v3__badge--dev">{text.devMode}</span> : null}
              <span className="plugins-v3__sr-only">{text.memoryNotes[memoryKey]}</span>
            </>
          ) : null}
        </div>
        <button className="plugins-v3__diag-link" type="button" onClick={onOpenDiagnostics}>{text.openDiagnostics}</button>
      </div>
      <PluginHostNodeRow watching={!open} />
      {open && host?.safe ? <SafeModeBanner key={host.pid} view={view} mode={host.safe} /> : null}
    </section>
  );
}

function HostDock({ view, now }: { view: PluginHostView; now: number }) {
  const text = useTranslation().settings.pluginsV3;
  const { host, connection, memory } = view;
  const measured = memory && host && memory.pid === host.pid ? memory : null;
  const open = connection === "open";
  const memoryKey = measured?.measure ?? "rss";
  return (
    <section className={`plugins-v3__dock settings-group${open && host?.safe ? " plugins-v3__dock--safe" : ""}`} aria-label={text.host}>
      <div className="plugins-v3__dock-top">
        <div className="plugins-v3__dock-main">
          <div className="plugins-v3__dock-headline">
            <span className={`plugins-v3__connection plugins-v3__connection--${connection}`} data-connection={connection}>{text.connection[connection]}</span>
            {open && host ? <span className="plugins-v3__host-meta">{text.hostDetail(host.pid, host.node)}</span> : null}
            {open && host?.dev ? <span className="plugins-v3__badge plugins-v3__badge--dev">{text.devMode}</span> : null}
          </div>
          {open && host ? <p className="plugins-v3__dock-note">{text.memoryNotes[memoryKey]}</p> : null}
        </div>
        {open && host ? (
          <div className="plugins-v3__metrics">
            <div className="plugins-v3__metric">
              <span className="plugins-v3__metric-label">{text.memoryTitles[memoryKey]}</span>
              <span className="plugins-v3__value" data-measure={memoryKey}>{megabytes(measured ? measured.bytes : host.rssBytes)}</span>
            </div>
            <div className="plugins-v3__metric">
              <span className="plugins-v3__metric-label">{text.hostCpu}</span>
              <span className="plugins-v3__value">{milliseconds(host.cpuMs)}</span>
            </div>
            <div className="plugins-v3__metric">
              <span className="plugins-v3__metric-label">{text.uptime}</span>
              <span className="plugins-v3__value">{duration(now - host.startedAt)}</span>
            </div>
          </div>
        ) : null}
      </div>
      <PluginHostNodeRow watching={!open} />
      {open && host?.safe ? <SafeModeBanner key={host.pid} view={view} mode={host.safe} /> : null}
    </section>
  );
}

function DiagnosticsTable({ builtins, hostPlugins, query, onSelectPlugin }: {
  builtins: readonly BuiltinPlugin[] | null;
  hostPlugins: PluginStatusV3[] | null;
  query: string;
  onSelectPlugin: (id: string) => void;
}) {
  const text = useTranslation().settings.pluginsV3;
  const builtinIds = new Set(builtins?.map((b) => b.id) ?? []);
  const hostById = new Map((hostPlugins ?? []).map((p) => [p.id, p]));
  const extras = (hostPlugins ?? []).filter((p) => !builtinIds.has(p.id));

  const rows = [
    ...extras.map((p) => ({ id: p.id, name: p.id, extra: p.name, kind: p.kind, state: stateOf(p), usage: p.usage, icon: Blocks })),
    ...(builtins ?? []).map((b) => {
      const id = b.id as BuiltinPluginName;
      const hp = hostById.get(b.id);
      return {
        id: b.id,
        name: (text.builtinNames as Record<string, string | undefined>)[id] ?? b.id,
        extra: "",
        kind: b.kind,
        state: hp ? stateOf(hp) : b.enabled ? ("running" as const) : ("disabled" as const),
        usage: hp?.usage,
        icon: (BUILTIN_ICONS as Record<string, LucideIcon | undefined>)[id] ?? Blocks,
      };
    }),
  ]
    .filter((row) => matchesPluginQuery(row.id, query, row.extra))
    .sort((a, b) => (b.usage?.errors ?? 0) - (a.usage?.errors ?? 0) || (b.usage?.cpuMs ?? 0) - (a.usage?.cpuMs ?? 0));

  return (
    <section className="plugins-v3__table-card settings-group" aria-label={text.plugins}>
      {rows.length === 0 ? (
        <p className="plugins-v3__empty">{text.noMatches}</p>
      ) : (
        <div className="plugins-v3__table-scroll">
          <table className="plugins-v3__diag-table">
            <thead>
              <tr>
                <th>{text.plugins}</th>
                <th>{text.stateCol}</th>
                <th className="plugins-v3__num">{text.cpu}</th>
                <th className="plugins-v3__num">{text.apply}</th>
                <th className="plugins-v3__num">{text.services}</th>
                <th className="plugins-v3__num">{text.timers}</th>
                <th className="plugins-v3__num">{text.listeners}</th>
                <th className="plugins-v3__num">{text.clients}</th>
                <th className="plugins-v3__num">{text.errors}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const Icon = row.icon;
                const tone = TONES[row.state];
                const u = row.usage;
                return (
                  <tr key={row.id} onClick={() => onSelectPlugin(row.id)}>
                    <td>
                      <div className="plugins-v3__diag-plugin">
                        <span className={`plugins-v3__icon plugins-v3__icon--sm plugins-v3__icon--${tone}`} aria-hidden="true">
                          <Icon size={14} strokeWidth={2} />
                          <span className="plugins-v3__dot" />
                        </span>
                        <div className="plugins-v3__title-col">
                          <div className="plugins-v3__title-line">
                            <span className="plugins-v3__plugin-name">{row.name}</span>
                            {row.kind && row.kind !== "builtin" ? <span className="plugins-v3__kind">{text.kinds[row.kind]}</span> : null}
                          </div>
                          <span className="plugins-v3__id">{row.id}</span>
                        </div>
                      </div>
                    </td>
                    <td><span className={`plugins-v3__foot-state plugins-v3__foot-state--${tone}`}>{text.states[row.state]}</span></td>
                    <td className="plugins-v3__num" title={u ? text.calls(u.calls) : undefined}>{u ? `${milliseconds(u.cpuMs)} (${u.calls})` : "–"}</td>
                    <td className="plugins-v3__num">{u && u.applyMs !== null ? milliseconds(u.applyMs) : "–"}</td>
                    <td className="plugins-v3__num">{u ? u.services : "–"}</td>
                    <td className="plugins-v3__num">{u ? u.timers : "–"}</td>
                    <td className="plugins-v3__num">{u ? u.listeners : "–"}</td>
                    <td className="plugins-v3__num">{u ? u.clients : "–"}</td>
                    <td className={`plugins-v3__num${u && u.errors > 0 ? " plugins-v3__diag-err" : ""}`}>{u ? u.errors : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="plugins-v3__footnotes">
        <SettingsFootnote text={text.cpuNote} />
        <SettingsFootnote text={text.preview} />
      </div>
    </section>
  );
}

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

export function PluginsV3View({ view, now = Date.now(), builtins: givenBuiltins }: {
  view: PluginHostView;
  now?: number;
  builtins?: readonly BuiltinPlugin[] | null;
}) {
  const text = useTranslation().settings.pluginsV3;
  const loadedBuiltins = useBuiltinPlugins();
  const builtins = givenBuiltins === undefined ? loadedBuiltins : givenBuiltins;
  const [tab, setTab] = useState<PluginsV3Tab>("plugins");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { host, plugins, connection, memory } = view;
  const measured = memory && host && memory.pid === host.pid ? memory : null;
  const open = connection === "open";
  const builtinIds = new Set(builtins?.map((item) => item.id) ?? []);
  const extras = (plugins ?? []).filter((item) => !builtinIds.has(item.id));
  const totalCount = (builtins?.length ?? 0) + extras.length;
  const hostById = new Map((plugins ?? []).map((item) => [item.id, item]));
  const runningCount =
    (builtins ?? []).filter((b) => {
      const hp = hostById.get(b.id);
      return hp ? stateOf(hp) === "running" : b.enabled;
    }).length + extras.filter((p) => stateOf(p) === "running").length;
  const selectedBuiltin = builtins?.find((b) => b.id === selectedId);
  const selectedHost = selectedId ? hostById.get(selectedId) : undefined;
  const switchTabKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next: PluginsV3Tab = tab === "plugins" ? "diagnostics" : "plugins";
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
            <span>{text.tabs.plugins(totalCount)}</span>
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
          <HostSummaryBar view={view} runningCount={runningCount} onOpenDiagnostics={() => setTab("diagnostics")} />
          <BuiltinPluginsGroup builtins={builtins} hostPlugins={plugins} hostEnabled={true} stale={!open} query={query} onSelectPlugin={setSelectedId} />
        </>
      ) : (
        <>
          <HostDock view={view} now={now} />
          <DiagnosticsTable builtins={builtins} hostPlugins={plugins} query={query} onSelectPlugin={setSelectedId} />
        </>
      )}

      {selectedId ? <PluginDetailModal builtin={selectedBuiltin} hostPlugin={selectedHost} onClose={() => setSelectedId(null)} /> : null}
    </>
  );
}

function HostConnectedPage({ connect, builtins }: { connect?: PluginHostConnector; builtins: readonly BuiltinPlugin[] | null }) {
  const view = usePluginHostStatus(connect);
  return <PluginsV3View view={view} builtins={builtins} />;
}

export function PluginsV3SettingsPage({ connect }: { connect?: PluginHostConnector }) {
  const text = useTranslation().settings.pluginsV3;
  const hostEnabled = usePluginHostEnabled();
  const builtins = useBuiltinPlugins();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedBuiltin = builtins?.find((b) => b.id === selectedId);
  return (
    <div className="plugins-v3">
      {hostEnabled === true ? <HostConnectedPage connect={connect} builtins={builtins} /> : null}
      {hostEnabled === false ? (
        <>
          <div className="plugins-v3__tabs-bar">
            <div className="plugins-v3__tabs" role="tablist">
              <button className="plugins-v3__tab plugins-v3__tab--active" type="button" role="tab" aria-selected={true} data-tab="plugins">
                <span>{text.tabs.plugins(builtins?.length ?? 0)}</span>
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
          <BuiltinPluginsGroup builtins={builtins} hostEnabled={false} query={query} onSelectPlugin={setSelectedId} />
          {selectedId ? <PluginDetailModal builtin={selectedBuiltin} onClose={() => setSelectedId(null)} /> : null}
        </>
      ) : null}
      {hostEnabled === null ? <BuiltinPluginsGroup builtins={builtins} hostEnabled={null} query={query} onSelectPlugin={setSelectedId} /> : null}
    </div>
  );
}
