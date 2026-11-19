import { useState } from "react";
import { useLocale, useTranslation } from "../../i18n";
import type { BuiltinPluginName } from "../../i18n/sections/settings/pluginsV3";
import type { BuiltinPlugin } from "../../features/plugin-kernel/api";
import { useBuiltinPlugins } from "../../features/plugin-kernel/useBuiltinPlugins";
import type { SettingsCategory } from "./categories";
import { PluginBisectCard } from "./PluginBisectCard";
import { BUILTIN_PAGES, megabytes, milliseconds } from "./pluginDisplay";
import { installedEntries } from "./pluginEntries";
import { RuntimeBanner, SafeBanner } from "./PluginPageBanners";
import { requestPluginDetail } from "./pluginPageHandoff";
import { stateOf } from "./pluginServiceStatus";
import type { RowDot } from "./pluginRowStatus";
import { usePluginHostNode } from "./usePluginHostNode";
import { usePluginHostEnabled, usePluginHostStatus, type PluginHostConnector, type PluginHostView, type PluginUsageV3 } from "./usePluginHostStatus";
import "./PluginPage.css";
import "./PluginDiagnosticsPage.css";

const PREVIEW_ROWS = 8;

interface DiagRow {
  id: string;
  name: string;
  builtin: boolean;
  dot: RowDot;
  label: string;
  usage?: PluginUsageV3;
}

function duration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${seconds % 60}s` : `${seconds}s`;
}

function ProcessCard({ view, hostOff, now }: { view: PluginHostView; hostOff: boolean; now: number }) {
  const t = useTranslation().settings.pluginsV3;
  const text = t.page.diagnostics;
  const { host, connection, memory } = view;
  if (hostOff) return <div className="plugin-card plugin-card--pad"><p className="plugin-diag__intro">{text.hostOff}</p></div>;
  const open = connection === "open" && host !== null;
  const measured = memory && host && memory.pid === host.pid ? memory : null;
  const memoryKey = measured?.measure ?? "rss";
  return (
    <div className="plugin-card plugin-card--pad" data-process={connection}>
      <div className="plugin-diag__line">
        <span className={`plugin-diag__state plugin-diag__state--${open ? "ok" : connection === "connecting" ? "wait" : "bad"}`}>{text.states[connection]}</span>
        {open ? <span>{text.processDetail(host.pid, host.node)}</span> : null}
        {open && host.dev ? <span className="plugin-badge">{t.devMode}</span> : null}
      </div>
      {open ? (
        <div className="plugin-metrics">
          <div className="plugin-metric" title={t.memoryNotes[memoryKey]}><span>{t.memoryTitles[memoryKey]}</span><b data-measure={memoryKey}>{megabytes(measured ? measured.bytes : host.rssBytes)}</b></div>
          <div className="plugin-metric"><span>{t.hostCpu}</span><b>{milliseconds(host.cpuMs)}</b></div>
          <div className="plugin-metric"><span>{t.uptime}</span><b>{duration(now - host.startedAt)}</b></div>
        </div>
      ) : null}
    </div>
  );
}

export function PluginDiagnosticsView({ view, hostOff = false, now = Date.now(), builtins: givenBuiltins, onOpenPage }: {
  view: PluginHostView;
  hostOff?: boolean;
  now?: number;
  builtins?: readonly BuiltinPlugin[] | null;
  onOpenPage?: (page: SettingsCategory) => void;
}) {
  const t = useTranslation().settings.pluginsV3;
  const text = t.page.diagnostics;
  const { locale } = useLocale();
  const loadedBuiltins = useBuiltinPlugins();
  const builtins = givenBuiltins === undefined ? loadedBuiltins : givenBuiltins;
  const [showAll, setShowAll] = useState(false);
  const { node, retry } = usePluginHostNode(!hostOff && view.connection !== "open");
  const live = view.connection === "open";
  const builtinIds = new Set(builtins?.map((item) => item.id) ?? []);
  const entries = installedEntries(view.plugins, builtinIds, null, { live, runtime: "ready", builtins }, locale);
  const hostById = new Map((view.plugins ?? []).map((plugin) => [plugin.id, plugin]));

  const rows: DiagRow[] = [
    ...entries.map((entry) => ({
      id: entry.id, name: entry.title, builtin: false, dot: entry.status.dot,
      label: entry.status.label ? t.page.labels[entry.status.label] : t.page.running, usage: entry.plugin.usage,
    })),
    ...(builtins ?? []).map((builtin) => {
      const hosted = hostById.get(builtin.id);
      const state = hosted ? stateOf(hosted) : builtin.enabled ? "running" : "disabled";
      const dot: RowDot = state === "running" ? "ok" : state === "failed" || state === "auto-disabled" ? "bad" : state === "waiting" || state === "loading" ? "wait" : "off";
      return { id: builtin.id, name: t.builtinNames[builtin.id as BuiltinPluginName] ?? builtin.id, builtin: true, dot, label: t.states[state], usage: hosted?.usage };
    }),
  ].sort((a, b) => (b.usage?.errors ?? 0) - (a.usage?.errors ?? 0) || (b.usage?.cpuMs ?? 0) - (a.usage?.cpuMs ?? 0));
  const visible = showAll ? rows : rows.slice(0, PREVIEW_ROWS);

  const openRow = (row: DiagRow) => {
    if (row.builtin) {
      const page = BUILTIN_PAGES[row.id as BuiltinPluginName];
      if (page) onOpenPage?.(page);
      return;
    }
    requestPluginDetail(row.id, "activity");
    onOpenPage?.("pluginsV3");
  };
  const openPlugin = (id: string) => {
    requestPluginDetail(id);
    onOpenPage?.("pluginsV3");
  };

  return (
    <div className="plugin-page plugin-diag">
      {hostOff ? null : <RuntimeBanner node={node} onRetry={retry} />}
      {live ? <SafeBanner view={view} onFindCulprit={() => document.querySelector("[data-bisect-phase]")?.scrollIntoView({ block: "center" })} /> : null}
      <h3 className="plugin-page__heading">{text.process}<span className="plugin-page__heading-meta">{text.processNote}</span></h3>
      <ProcessCard view={view} hostOff={hostOff} now={now} />
      <h3 className="plugin-page__heading">{text.bisectTitle}</h3>
      <PluginBisectCard plugins={entries.map((entry) => ({ id: entry.id, title: entry.title }))} onBisect={live ? view.bisect : undefined} onOpenPlugin={openPlugin} />
      <h3 className="plugin-page__heading">{text.allModules}<span className="plugin-page__heading-meta">{text.allModulesMeta(entries.length, builtins?.length ?? 0)}</span></h3>
      <div className="plugin-card">
        <div className="plugin-diag__scroll">
          <table className="plugin-diag__table">
            <thead>
              <tr>
                <th>{text.name}</th>
                <th>{t.stateCol}</th>
                <th className="plugin-diag__num">{t.cpu}</th>
                <th className="plugin-diag__num">{t.apply}</th>
                <th className="plugin-diag__num">{t.resourcesCol}</th>
                <th className="plugin-diag__num">{t.errors}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const u = row.usage;
                const resources = u ? u.services + u.timers + u.listeners + u.clients : null;
                return (
                  <tr key={row.id} data-diag-row={row.id} tabIndex={0} onClick={() => openRow(row)} onKeyDown={(event) => event.key === "Enter" && openRow(row)}>
                    <td>
                      <span className="plugin-diag__name">
                        <span className={`plugin-diag__dot plugin-icon__dot--${row.dot}`} aria-hidden="true" />
                        {row.name}
                        <span className="plugin-diag__kind">{row.builtin ? text.kindBuiltin : text.kindPlugin}</span>
                      </span>
                    </td>
                    <td>{row.label}</td>
                    <td className="plugin-diag__num" title={u ? t.calls(u.calls) : undefined}>{u ? milliseconds(u.cpuMs) : "–"}</td>
                    <td className="plugin-diag__num">{u && u.applyMs !== null ? milliseconds(u.applyMs) : "–"}</td>
                    <td className="plugin-diag__num">{resources ?? "–"}</td>
                    <td className={`plugin-diag__num${u && u.errors > 0 ? " plugin-diag__err" : ""}`}>{u ? u.errors : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length > PREVIEW_ROWS ? (
          <div className="plugin-diag__more">
            <button className="plugin-link" type="button" data-action="diag-show-all" onClick={() => setShowAll((value) => !value)}>
              {showAll ? text.showLess : text.showAll(rows.length)}
            </button>
          </div>
        ) : null}
      </div>
      <p className="plugin-foot">{text.footnote}</p>
    </div>
  );
}

function ConnectedDiagnostics({ connect, onOpenPage }: { connect?: PluginHostConnector; onOpenPage?: (page: SettingsCategory) => void }) {
  const view = usePluginHostStatus(connect);
  return <PluginDiagnosticsView view={view} onOpenPage={onOpenPage} />;
}

const OFF_VIEW: PluginHostView = { connection: "closed", plugins: [], host: null, memory: null, safeMode: null };

export function PluginDiagnosticsPage({ connect, onOpenPage }: { connect?: PluginHostConnector; onOpenPage?: (page: SettingsCategory) => void }) {
  const hostEnabled = usePluginHostEnabled();
  if (hostEnabled === null) return null;
  return hostEnabled ? <ConnectedDiagnostics connect={connect} onOpenPage={onOpenPage} /> : <PluginDiagnosticsView view={OFF_VIEW} hostOff onOpenPage={onOpenPage} />;
}
