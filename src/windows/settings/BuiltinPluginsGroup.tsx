import { useId, useState, type MouseEvent } from "react";
import {
  Blocks, Bot, Calendar, Camera, CircleDot, ClipboardList, Crop, Gauge, Headphones, Inbox,
  Languages, ListTodo, MessageCircle, Mic, Music, Plug, RefreshCw, Smartphone, Sparkles,
  Store, Timer, Volume2, Waypoints, type LucideIcon,
} from "lucide-react";
import { marketV1 } from "@fuyu/plugin-services";
import { useErrorText, useTranslation } from "../../i18n";
import { en as enPluginsV3, zhCN as zhPluginsV3, type BuiltinPluginName, type PluginV3Group, type PluginV3State } from "../../i18n/sections/settings/pluginsV3";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import type { BuiltinPlugin } from "../../features/plugin-kernel/api";
import { windowServices } from "../../features/plugin-kernel/services";
import type { SettingsCategory } from "./categories";
import { detailText, stateOf } from "./pluginServiceStatus";
import type { PluginStatusV3 } from "./usePluginHostStatus";
import "./PluginMarketV3Tab.css";

export { detailText, stateOf };

const marketClient = windowServices.get(marketV1);

type InstalledFilter = "all" | "attention" | "off";

export const TONES: Record<PluginV3State, string> = {
  running: "ok", waiting: "warn", loading: "warn", failed: "bad",
  "auto-disabled": "bad", "safe-mode": "info", bisect: "info", disabled: "off", stopped: "off", unloading: "off",
};

export const BUILTIN_GROUPS: Record<BuiltinPluginName, Exclude<PluginV3Group, "third-party">> = {
  todos: "core", calendar: "core", music: "core", clipboard: "core", screenshot: "core",
  "file-shelf": "core", translation: "core", "voice-input": "core", timer: "core", messages: "core",
  agents: "ai", "session-ring": "ai", "claude-usage": "ai", "cc-connect": "ai", "ssh-tunnel": "ai", "local-api": "ai",
  "center-pattern": "system", "device-events": "system", "system-levels": "system",
  "device-use": "system", "theme-market": "system", updater: "system",
};

export const BUILTIN_ICONS: Record<BuiltinPluginName, LucideIcon> = {
  todos: ListTodo, calendar: Calendar, music: Music, clipboard: ClipboardList, screenshot: Crop,
  "file-shelf": Inbox, translation: Languages, "voice-input": Mic, timer: Timer, messages: MessageCircle,
  agents: Bot, "session-ring": CircleDot, "claude-usage": Gauge, "cc-connect": Smartphone,
  "ssh-tunnel": Waypoints, "local-api": Plug, "center-pattern": Sparkles, "device-events": Headphones,
  "system-levels": Volume2, "device-use": Camera, "theme-market": Store, updater: RefreshCw,
};

export const BUILTIN_PAGES: Record<BuiltinPluginName, SettingsCategory> = {
  todos: "todos", calendar: "calendar", music: "music", clipboard: "clipboard", screenshot: "screenshot",
  "file-shelf": "shelf", translation: "translation", "voice-input": "voiceInput", timer: "timerAlerts", messages: "messages",
  agents: "agents", "session-ring": "agentRings", "claude-usage": "agentRings", "cc-connect": "agentPush",
  "ssh-tunnel": "agentRemote", "local-api": "generalApi", "center-pattern": "appearanceCollapsed",
  "device-events": "behaviorAlerts", "system-levels": "behaviorAlerts", "device-use": "behaviorAlerts",
  "theme-market": "themeMarket", updater: "about",
};

export function milliseconds(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(ms < 10 ? 2 : ms < 100 ? 1 : 0)} ms`;
}

export function isAttentionState(state: PluginV3State): boolean {
  return state === "failed" || state === "auto-disabled" || state === "safe-mode" || state === "waiting" || state === "bisect";
}

export function isManagedThirdParty(plugin?: PluginStatusV3): boolean {
  return plugin?.source === "market" || plugin?.source === "manual";
}

export function isOfficialMarketPlugin(plugin?: PluginStatusV3): boolean {
  return plugin?.source === "market" && plugin.id.startsWith("@fuyu/");
}

export function isExternalPlugin(plugin: PluginStatusV3, builtinIds: ReadonlySet<string>): boolean {
  return !builtinIds.has(plugin.id) && plugin.kind !== "builtin" && plugin.kind !== "essential";
}

export function matchesPluginQuery(id: string, query: string, extraText = ""): boolean {
  const q = query.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (!q) return true;
  const key = id as BuiltinPluginName;
  const haystack = [id, extraText, zhPluginsV3.builtinNames[key], enPluginsV3.builtinNames[key], zhPluginsV3.builtinNotes[key], enPluginsV3.builtinNotes[key], zhPluginsV3.builtinSummaries[key], enPluginsV3.builtinSummaries[key]]
    .filter(Boolean).join(" ").toLowerCase().replace(/[\s_-]+/g, "");
  return haystack.includes(q);
}

export function PluginUsageList({ plugin }: { plugin: PluginStatusV3 }) {
  const text = useTranslation().settings.pluginsV3;
  const usage = plugin.usage;
  if (!usage) return null;
  return (
    <dl className="plugins-v3__usage">
      <div><dt>{text.cpu}</dt><dd title={text.calls(usage.calls)}>{milliseconds(usage.cpuMs)}</dd></div>
      <div><dt>{text.apply}</dt><dd>{usage.applyMs === null ? "–" : milliseconds(usage.applyMs)}</dd></div>
      <div><dt>{text.timers}</dt><dd>{usage.timers}</dd></div>
      <div><dt>{text.listeners}</dt><dd>{usage.listeners}</dd></div>
      <div><dt>{text.services}</dt><dd>{usage.services}</dd></div>
      <div><dt>{text.clients}</dt><dd>{usage.clients}</dd></div>
      <div className={usage.errors > 0 ? "plugins-v3__errors" : undefined}><dt>{text.errors}</dt><dd>{usage.errors}</dd></div>
    </dl>
  );
}

export function PluginLastErrorDetails({ plugin, defaultOpen = false }: { plugin: PluginStatusV3; defaultOpen?: boolean }) {
  const text = useTranslation().settings.pluginsV3;
  if (!plugin.lastError) return null;
  return (
    <details className="plugins-v3__last-error" open={defaultOpen || undefined}>
      <summary>{text.lastError}</summary>
      <pre>{plugin.lastError.text}</pre>
    </details>
  );
}

const INTERACTIVE = "button, input, label, summary, details, .settings-switch";

function displayTitleOf(plugin: PluginStatusV3): string {
  const raw = plugin.name?.trim();
  if (!raw || raw.startsWith("./") || raw.startsWith("../") || raw.startsWith("file:")) return plugin.id;
  return raw;
}

export function HostPluginCard({
  plugin,
  hostPlugins,
  builtins,
  onSelect,
}: {
  plugin: PluginStatusV3;
  hostPlugins?: readonly PluginStatusV3[] | null;
  builtins?: readonly BuiltinPlugin[] | null;
  onSelect?: () => void;
}) {
  const text = useTranslation().settings.pluginsV3;
  const errorText = useErrorText();
  const switchId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = stateOf(plugin);
  const tone = TONES[state];
  const detail = detailText(plugin, text, hostPlugins, builtins);
  const managed = isManagedThirdParty(plugin);
  const official = isOfficialMarketPlugin(plugin);
  const enabled = state !== "disabled";
  const title = displayTitleOf(plugin);
  const subtitle = title !== plugin.id ? plugin.id : plugin.name && plugin.name !== plugin.id ? plugin.name : null;
  const toggle = (next: boolean) => {
    setBusy(true);
    setError(null);
    void marketClient.setEnabled({ id: plugin.id, enabled: next }).catch((failure: unknown) => setError(errorText(failure))).finally(() => setBusy(false));
  };
  const openCard = (event: MouseEvent<HTMLElement>) => {
    if (onSelect && !(event.target as Element).closest(INTERACTIVE)) onSelect();
  };
  return (
    <article
      className={`plugins-v3__card plugins-v3__plugin plugins-v3__plugin--${tone}${managed && !enabled ? " plugins-v3__card--off" : ""}`}
      data-plugin={plugin.id}
      data-state={state}
      onClick={openCard}
    >
      <div className="plugins-v3__plugin-head">
        <span className={`plugins-v3__icon plugins-v3__icon--${tone}`} aria-hidden="true">
          <Blocks size={16} strokeWidth={2} />
          <span className="plugins-v3__dot" />
        </span>
        <div className="plugins-v3__title-col">
          <div className="plugins-v3__title-line">
            {managed ? (
              <label className="plugins-v3__plugin-name" htmlFor={switchId} title={title}>{title}</label>
            ) : (
              <span className="plugins-v3__plugin-name" title={title}>{title}</span>
            )}
            {official ? (
              <span className="plugins-v3__pill plugins-v3__pill--official">{text.market.officialBadge}</span>
            ) : plugin.kind ? (
              <span className="plugins-v3__kind">{text.kinds[plugin.kind]}</span>
            ) : null}
            {plugin.source === "manual" && text.unreviewedBadge ? <span className="plugins-v3__kind">{text.unreviewedBadge}</span> : null}
            <span className="plugins-v3__state">{text.states[state]}</span>
          </div>
          {subtitle ? <span className="plugins-v3__id">{subtitle}</span> : null}
        </div>
        {managed ? (
          <div className="plugins-v3__switch">
            <SettingsSwitch id={switchId} checked={enabled} disabled={busy} onChange={toggle} />
          </div>
        ) : null}
      </div>
      {error ? <p className="plugins-v3__detail plugins-v3__detail--bad">{error}</p> : null}
      {detail ? <p className={`plugins-v3__detail plugins-v3__detail--${tone}`}>{detail}</p> : null}
      <PluginLastErrorDetails plugin={plugin} />
      {onSelect ? (
        <div className="plugins-v3__card-foot">
          <span className={`plugins-v3__foot-state plugins-v3__foot-state--${tone}`}>{text.states[state]}</span>
          <span className="plugins-v3__foot-actions">
            <button className="plugins-v3__foot-btn" type="button" onClick={onSelect}>{text.viewDetail}</button>
          </span>
        </div>
      ) : null}
    </article>
  );
}

export function BuiltinPluginsGroup({
  builtins,
  hostPlugins = null,
  hostEnabled = null,
  stale = false,
  query = "",
  onSelectPlugin,
  onOpenMarketTab,
}: {
  builtins: readonly BuiltinPlugin[] | null;
  hostPlugins?: PluginStatusV3[] | null;
  hostEnabled?: boolean | null;
  stale?: boolean;
  query?: string;
  onSelectPlugin: (id: string) => void;
  onOpenMarketTab?: () => void;
}) {
  const text = useTranslation().settings.pluginsV3;
  const [filter, setFilter] = useState<InstalledFilter>("all");
  const builtinIds = new Set(builtins?.map((item) => item.id) ?? []);
  const extraPlugins = (hostPlugins ?? []).filter((item) => isExternalPlugin(item, builtinIds));

  const attentionCount = extraPlugins.filter((p) => isAttentionState(stateOf(p))).length;
  const offCount = extraPlugins.filter((p) => stateOf(p) === "disabled").length;
  const counts: Record<InstalledFilter, number> = {
    all: extraPlugins.length,
    attention: attentionCount,
    off: offCount,
  };
  const activeFilter: InstalledFilter = counts[filter] === 0 && filter !== "all" ? "all" : filter;

  const filteredExtras = extraPlugins.filter((item) => {
    const state = stateOf(item);
    if (activeFilter === "off" && state !== "disabled") return false;
    if (activeFilter === "attention" && !isAttentionState(state)) return false;
    return matchesPluginQuery(item.id, query, item.name);
  });

  const filterButtons: [InstalledFilter, number][] = [
    ["all", extraPlugins.length],
    ...(attentionCount > 0 ? ([["attention", attentionCount]] as [InstalledFilter, number][]) : []),
    ...(offCount > 0 ? ([["off", offCount]] as [InstalledFilter, number][]) : []),
  ];

  return (
    <div className={`plugins-v3__body plugins-v3__list${stale ? " plugins-v3__list--stale" : ""}`}>
      {extraPlugins.length > 0 && filterButtons.length > 1 ? (
        <div className="plugins-v3__filters" role="group" aria-label={text.plugins}>
          {filterButtons.map(([key, count]) => (
            <button key={key} className="plugins-v3__filter" type="button" aria-pressed={activeFilter === key} onClick={() => setFilter(activeFilter === key ? "all" : key)}>
              {text.filters[key](count)}
            </button>
          ))}
        </div>
      ) : null}

      {hostEnabled === true && hostPlugins === null ? (
        <p className="plugins-v3__empty">{text.waitingHost}</p>
      ) : extraPlugins.length === 0 ? (
        <div className="plugins-v3__empty plugins-v3__empty-box">
          <p>{text.empty}</p>
          {onOpenMarketTab ? (
            <button className="plugins-v3__btn plugins-v3__btn--primary" type="button" data-action="open-market-tab" onClick={onOpenMarketTab}>
              {text.browseMarket}
            </button>
          ) : null}
        </div>
      ) : filteredExtras.length === 0 ? (
        <p className="plugins-v3__empty">{text.noMatches}</p>
      ) : (
        <div className="plugins-v3__grid">
          {filteredExtras.map((plugin) => (
            <HostPluginCard
              key={plugin.id}
              plugin={plugin}
              hostPlugins={hostPlugins}
              builtins={builtins}
              onSelect={() => onSelectPlugin(plugin.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
