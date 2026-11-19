import type { ReactNode } from "react";
import { Activity, Blocks, LifeBuoy, Power, ShieldAlert, ShieldCheck, Store, type LucideIcon } from "lucide-react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import type { BuiltinPlugin } from "../../features/plugin-kernel/api";
import { useBuiltinPlugins } from "../../features/plugin-kernel/useBuiltinPlugins";
import { useTranslation } from "../../i18n";
import { AboutPluginBuild } from "./AboutPluginBuild";
import type { SettingsCategory } from "./categories";
import { isExternalPlugin } from "./pluginDisplay";
import { usePluginHostEnabled, usePluginHostStatus, type PluginHostConnector, type PluginHostView } from "./usePluginHostStatus";
import "./AboutPluginSystem.css";

const OFF_VIEW: PluginHostView = { connection: "closed", plugins: [], host: null, memory: null, safeMode: null };
const LOADING_VIEW: PluginHostView = { ...OFF_VIEW, connection: "connecting", plugins: null };

type ProcessTone = "ok" | "wait" | "bad" | "off";

function processTone(view: PluginHostView, hostOff: boolean): ProcessTone {
  if (hostOff) return "off";
  if (view.connection === "open") return "ok";
  return view.connection === "connecting" || view.connection === "reconnecting" ? "wait" : "bad";
}

function Stat({ name, label, value, note, tone }: { name: string; label: string; value: ReactNode; note: ReactNode; tone?: ProcessTone }) {
  return (
    <div className="about-plugins__stat" data-stat={name} data-tone={tone}>
      <dt>{label}</dt>
      <dd>
        <b>{value}</b>
        {note ? <span>{note}</span> : null}
      </dd>
    </div>
  );
}

function Point({ Icon, tone = "accent", title, children }: { Icon: LucideIcon; tone?: "accent" | "mint" | "warn"; title: string; children: ReactNode }) {
  return (
    <div className="about-plugins__point">
      <span className={`about-plugins__point-icon about-plugins__point-icon--${tone}`} aria-hidden="true">
        <Icon size={15} strokeWidth={2} />
      </span>
      <div className="about-plugins__point-text">
        <strong>{title}</strong>
        <span>{children}</span>
      </div>
    </div>
  );
}

function Lead({ view, hostOff, builtins, onOpenPage }: {
  view: PluginHostView;
  hostOff: boolean;
  builtins: readonly BuiltinPlugin[] | null;
  onOpenPage: (page: SettingsCategory) => void;
}) {
  const t = useTranslation().settings;
  const text = t.aboutPlugins;
  const builtinIds = new Set(builtins?.map((plugin) => plugin.id) ?? []);
  const installed = hostOff || view.plugins === null ? null : view.plugins.filter((plugin) => isExternalPlugin(plugin, builtinIds)).length;
  const pages = [
    { page: "pluginsV3", label: text.actions.manage, Icon: Blocks },
    { page: "pluginMarket", label: text.actions.market, Icon: Store },
    { page: "pluginDiagnostics", label: text.actions.diagnostics, Icon: Activity },
  ] as const;

  return (
    <section className="about-plugins__lead" aria-label={text.title}>
      <span className="about-plugins__emblem" aria-hidden="true"><Blocks size={22} strokeWidth={1.8} /></span>
      <h2 className="about-plugins__title">{text.title}</h2>
      <p className="about-plugins__text">{text.lead}</p>
      <dl className="about-plugins__stats" aria-label={text.stats.label}>
        <Stat
          name="builtins"
          label={text.stats.builtins}
          value={builtins ? builtins.length : text.stats.unknown}
          note={builtins ? text.stats.builtinsOn(builtins.filter((plugin) => plugin.enabled).length) : null}
        />
        <Stat name="installed" label={text.stats.installed} value={installed ?? text.stats.unknown} note={text.stats.installedNote} />
        <Stat
          name="process"
          label={text.stats.process}
          tone={processTone(view, hostOff)}
          value={hostOff ? text.stats.processOff : t.pluginsV3.page.diagnostics.states[view.connection]}
          note={!hostOff && view.connection === "open" && view.host ? text.stats.processNode(view.host.node) : null}
        />
      </dl>
      <nav className="about-plugins__actions" aria-label={text.actions.label}>
        {pages.map(({ page, label, Icon }) => (
          <button key={page} className="about-plugins__action" type="button" data-open-page={page} onClick={() => onOpenPage(page)}>
            <Icon size={13} strokeWidth={1.9} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </section>
  );
}

export function AboutPluginSystemView({ view, hostOff = false, builtins, onOpenPage }: {
  view: PluginHostView;
  hostOff?: boolean;
  builtins: readonly BuiltinPlugin[] | null;
  onOpenPage: (page: SettingsCategory) => void;
}) {
  const text = useTranslation().settings.aboutPlugins;
  return (
    <>
      <Lead view={view} hostOff={hostOff} builtins={builtins} onOpenPage={onOpenPage} />
      <AboutPluginBuild />
      <SettingsGroup title={text.meaningTitle}>
        <Point Icon={Power} title={text.meaning.off.title}>{text.meaning.off.body}</Point>
        <Point Icon={Store} title={text.meaning.add.title}>{text.meaning.add.body}</Point>
        <Point Icon={LifeBuoy} tone="mint" title={text.meaning.safe.title}>{text.meaning.safe.body}</Point>
      </SettingsGroup>
      <SettingsGroup title={text.trustTitle}>
        <Point Icon={ShieldAlert} tone="warn" title={text.trust.same.title}>{text.trust.same.body}</Point>
        <Point Icon={ShieldCheck} tone="mint" title={text.trust.guard.title}>{text.trust.guard.body}</Point>
      </SettingsGroup>
    </>
  );
}

function Connected({ connect, onOpenPage }: { connect?: PluginHostConnector; onOpenPage: (page: SettingsCategory) => void }) {
  const view = usePluginHostStatus(connect);
  return <AboutPluginSystemView view={view} builtins={useBuiltinPlugins()} onOpenPage={onOpenPage} />;
}

export function AboutPluginSystem({ connect, onOpenPage }: { connect?: PluginHostConnector; onOpenPage: (page: SettingsCategory) => void }) {
  const hostEnabled = usePluginHostEnabled();
  const builtins = useBuiltinPlugins();
  if (hostEnabled === null) return <AboutPluginSystemView view={LOADING_VIEW} builtins={builtins} onOpenPage={onOpenPage} />;
  return hostEnabled ? <Connected connect={connect} onOpenPage={onOpenPage} /> : <AboutPluginSystemView view={OFF_VIEW} hostOff builtins={builtins} onOpenPage={onOpenPage} />;
}
