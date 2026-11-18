import { useState } from "react";
import { Blocks, type LucideIcon } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { BuiltinPluginName } from "../../i18n/sections/settings/pluginsV3";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { exitPluginSafeMode, type BuiltinPlugin } from "../../features/plugin-kernel/api";
import { BUILTIN_ICONS, matchesPluginQuery, milliseconds, stateOf, TONES } from "./BuiltinPluginsGroup";
import { PluginHostNodeRow } from "./PluginHostNodeRow";
import type { PluginHostView, PluginStatusV3 } from "./usePluginHostStatus";

export function megabytes(bytes: number) {
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

export function HostSummaryBar({ view, runningCount, onOpenDiagnostics }: { view: PluginHostView; runningCount: number; onOpenDiagnostics: () => void }) {
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
              <span className="plugins-v3__host-meta">
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

export function PluginDiagnosticsTab({
  view,
  now,
  builtins,
  hostPlugins,
  query,
  onSelectPlugin,
}: {
  view: PluginHostView;
  now: number;
  builtins: readonly BuiltinPlugin[] | null;
  hostPlugins: PluginStatusV3[] | null;
  query: string;
  onSelectPlugin: (id: string) => void;
}) {
  const text = useTranslation().settings.pluginsV3;
  const { host, connection, memory } = view;
  const measured = memory && host && memory.pid === host.pid ? memory : null;
  const open = connection === "open";
  const memoryKey = measured?.measure ?? "rss";

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
    <>
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
                  <th className="plugins-v3__num">{text.resourcesCol}</th>
                  <th className="plugins-v3__num">{text.errors}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const Icon = row.icon;
                  const tone = TONES[row.state];
                  const u = row.usage;
                  const resourceParts = u
                    ? [
                        u.services > 0 ? `${text.services} ${u.services}` : "",
                        u.timers > 0 ? `${text.timers} ${u.timers}` : "",
                        u.listeners > 0 ? `${text.listeners} ${u.listeners}` : "",
                        u.clients > 0 ? `${text.clients} ${u.clients}` : "",
                      ].filter(Boolean)
                    : [];
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
                      <td className="plugins-v3__num">{u ? `${milliseconds(u.cpuMs)} (${u.calls})` : "–"}</td>
                      <td className="plugins-v3__num">{u && u.applyMs !== null ? milliseconds(u.applyMs) : "–"}</td>
                      <td className="plugins-v3__num">{u ? (resourceParts.length > 0 ? resourceParts.join(" · ") : "0") : "–"}</td>
                      <td className={`plugins-v3__num${u && u.errors > 0 ? " plugins-v3__diag-err" : ""}`}>{u ? u.errors : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="plugins-v3__footnotes">
          <SettingsFootnote text={`${text.cpuNote} ${text.preview}`} />
        </div>
      </section>
    </>
  );
}
