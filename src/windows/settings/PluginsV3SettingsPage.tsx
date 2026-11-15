import { useTranslation } from "../../i18n";
import type { PluginV3State } from "../../i18n/sections/settings/pluginsV3";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useState } from "react";
import { exitPluginSafeMode } from "../../features/plugin-kernel/api";
import { BuiltinPluginsGroup } from "./BuiltinPluginsGroup";
import { usePluginHostEnabled, usePluginHostStatus, type PluginHostConnector, type PluginHostView, type PluginStatusV3 } from "./usePluginHostStatus";
import "./PluginsV3SettingsPage.css";

const STATES: readonly PluginV3State[] = ["running", "waiting", "failed", "disabled", "auto-disabled", "safe-mode", "loading", "stopped", "unloading"];

const TONES: Record<PluginV3State, string> = {
  running: "ok",
  waiting: "warn",
  loading: "warn",
  failed: "bad",
  "auto-disabled": "bad",
  "safe-mode": "info",
  disabled: "off",
  stopped: "off",
  unloading: "off",
};

function stateOf(plugin: PluginStatusV3): PluginV3State {
  return (STATES as readonly string[]).includes(plugin.state) ? (plugin.state as PluginV3State) : "loading";
}

function megabytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function milliseconds(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(ms < 10 ? 2 : ms < 100 ? 1 : 0)} ms`;
}

function duration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${seconds % 60}s` : `${seconds}s`;
}

function PluginCard({ plugin }: { plugin: PluginStatusV3 }) {
  const text = useTranslation().settings.pluginsV3;
  const state = stateOf(plugin);
  const usage = plugin.usage;
  const blocked = plugin.blocked;
  const detail =
    state === "waiting" && plugin.waitingFor?.length ? text.waitingFor(plugin.waitingFor.join(", "))
    : blocked?.by === "errors" ? text.autoDisabled(blocked.errors, Math.round(blocked.windowMs / 1000))
    : blocked?.by === "safe-mode" ? text.heldBySafeMode(text.safeModes[blocked.mode])
    : plugin.reason ?? plugin.error ?? null;
  return (
    <div className={`plugins-v3__plugin plugins-v3__plugin--${TONES[state]}`} data-plugin={plugin.id} data-state={state}>
      <div className="plugins-v3__plugin-head">
        <span className="plugins-v3__plugin-name" title={plugin.name}>{plugin.id}</span>
        {plugin.kind ? <span className="plugins-v3__kind">{text.kinds[plugin.kind]}</span> : null}
        <span className="plugins-v3__state">{text.states[state]}</span>
      </div>
      {detail ? <p className="plugins-v3__detail">{detail}</p> : null}
      {usage ? (
        <dl className="plugins-v3__usage">
          <div><dt>{text.cpu}</dt><dd title={text.calls(usage.calls)}>{milliseconds(usage.cpuMs)}</dd></div>
          <div><dt>{text.apply}</dt><dd>{usage.applyMs === null ? "–" : milliseconds(usage.applyMs)}</dd></div>
          <div><dt>{text.timers}</dt><dd>{usage.timers}</dd></div>
          <div><dt>{text.listeners}</dt><dd>{usage.listeners}</dd></div>
          <div><dt>{text.services}</dt><dd>{usage.services}</dd></div>
          <div><dt>{text.clients}</dt><dd>{usage.clients}</dd></div>
          <div className={usage.errors > 0 ? "plugins-v3__errors" : undefined}><dt>{text.errors}</dt><dd>{usage.errors}</dd></div>
        </dl>
      ) : null}
      {plugin.lastError ? (
        <details className="plugins-v3__last-error">
          <summary>{text.lastError}</summary>
          <pre>{plugin.lastError.text}</pre>
        </details>
      ) : null}
    </div>
  );
}

function SafeModeRow({ view, mode }: { view: PluginHostView; mode: "third-party" | "minimal" }) {
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
    <SettingsRow
      searchable={false}
      className="plugins-v3__safe"
      title={`${text.safeMode} · ${text.safeModes[mode]}`}
      description={cause}
      control={canLeave ? <button className="plugins-v3__leave" type="button" disabled={leaving} onClick={leave}>{text.leaveSafeMode}</button> : undefined}
    />
  );
}

export function PluginsV3View({ view, now = Date.now() }: { view: PluginHostView; now?: number }) {
  const text = useTranslation().settings.pluginsV3;
  const { host, plugins, connection, memory } = view;
  const measured = memory && host && memory.pid === host.pid ? memory : null;
  const open = connection === "open";
  return (
    <>
      <SettingsGroup title={text.host}>
        <SettingsRow
          searchable={false}
          title={<span className={`plugins-v3__connection plugins-v3__connection--${connection}`} data-connection={connection}>{text.connection[connection]}</span>}
          description={open && host ? text.hostDetail(host.pid, host.node) : undefined}
        />
        {open && host ? (
          <>
            <SettingsRow
              searchable={false}
              title={measured ? text.memoryTitles[measured.measure] : text.memoryTitles.rss}
              description={measured ? text.memoryNotes[measured.measure] : text.memoryNotes.rss}
              control={<span className="plugins-v3__value" data-measure={measured?.measure ?? "rss"}>{megabytes(measured ? measured.bytes : host.rssBytes)}</span>}
            />
            <SettingsRow searchable={false} title={text.hostCpu} control={<span className="plugins-v3__value">{milliseconds(host.cpuMs)}</span>} />
            <SettingsRow searchable={false} title={text.uptime} control={<span className="plugins-v3__value">{duration(now - host.startedAt)}</span>} />
            {host.safe ? <SafeModeRow key={host.pid} view={view} mode={host.safe} /> : null}
            {host.dev ? <SettingsRow searchable={false} title={text.devMode} /> : null}
          </>
        ) : null}
      </SettingsGroup>
      <SettingsGroup title={text.plugins} footer={<SettingsFootnote text={text.cpuNote} />}>
        {plugins === null ? (
          <p className="plugins-v3__empty">{text.waitingHost}</p>
        ) : plugins.length === 0 ? (
          <p className="plugins-v3__empty">{text.empty}</p>
        ) : (
          <div className={`plugins-v3__list${open ? "" : " plugins-v3__list--stale"}`}>
            {plugins.map((plugin) => <PluginCard key={plugin.id} plugin={plugin} />)}
          </div>
        )}
      </SettingsGroup>
    </>
  );
}

function HostStatus({ connect }: { connect?: PluginHostConnector }) {
  const view = usePluginHostStatus(connect);
  return <PluginsV3View view={view} />;
}

export function PluginsV3SettingsPage({ connect }: { connect?: PluginHostConnector }) {
  const text = useTranslation().settings.pluginsV3;
  const hostEnabled = usePluginHostEnabled();
  return (
    <div className="plugins-v3">
      <SettingsFootnote text={text.preview} />
      <BuiltinPluginsGroup />
      {hostEnabled === true ? <HostStatus connect={connect} /> : null}
      {hostEnabled === false ? (
        <SettingsGroup title={text.host}>
          <SettingsRow searchable={false} title={<span className="plugins-v3__connection plugins-v3__connection--closed" data-connection="off">{text.hostOff}</span>} description={text.hostOffNote} />
        </SettingsGroup>
      ) : null}
    </div>
  );
}
