import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import {
  Blocks, Bot, Calendar, Camera, CircleDot, ClipboardList, Crop, Gauge, Headphones, Inbox,
  Languages, ListTodo, MessageCircle, Mic, Music, Plug, RefreshCw, Smartphone, Sparkles,
  Store, Timer, Volume2, Waypoints, X, type LucideIcon,
} from "lucide-react";
import { TRANSLATIONS, useErrorText, useTranslation } from "../../i18n";
import type { BuiltinPluginName, PluginV3Filter, PluginV3Group, PluginV3State } from "../../i18n/sections/settings/pluginsV3";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import type { BuiltinPlugin } from "../../features/plugin-kernel/api";
import { switchBuiltinPlugin } from "../../features/plugin-kernel/builtinSwitches";
import type { SettingsCategory } from "./categories";
import { detailText, stateOf } from "./pluginServiceStatus";
import type { PluginStatusV3 } from "./usePluginHostStatus";

export { detailText, stateOf };

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

const BUILTIN_PAGES: Record<BuiltinPluginName, SettingsCategory> = {
  todos: "todos", calendar: "calendar", music: "music", clipboard: "clipboard", screenshot: "screenshot",
  "file-shelf": "shelf", translation: "translation", "voice-input": "voiceInput", timer: "timerAlerts", messages: "messages",
  agents: "agents", "session-ring": "agentSessions", "claude-usage": "agentRings", "cc-connect": "agentAlerts",
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

export function matchesPluginQuery(id: string, query: string, extraText = ""): boolean {
  const q = query.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (!q) return true;
  const zh = TRANSLATIONS["zh-CN"].settings.pluginsV3;
  const en = TRANSLATIONS.en.settings.pluginsV3;
  const key = id as BuiltinPluginName;
  const haystack = [id, extraText, zh.builtinNames[key], en.builtinNames[key], zh.builtinNotes[key], en.builtinNotes[key], zh.builtinSummaries[key], en.builtinSummaries[key]]
    .filter(Boolean).join(" ").toLowerCase().replace(/[\s_-]+/g, "");
  return haystack.includes(q);
}

function resourceSummary(plugin: PluginStatusV3 | undefined, text: ReturnType<typeof useTranslation>["settings"]["pluginsV3"]): string {
  const u = plugin?.usage;
  if (!u) return text.viewDetail;
  const parts = [
    u.services > 0 ? `${u.services} ${text.services}` : "",
    u.timers > 0 ? `${u.timers} ${text.timers}` : "",
    u.listeners > 0 ? `${u.listeners} ${text.listeners}` : "",
    u.errors > 0 ? `${u.errors} ${text.errors}` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : text.noResources;
}

function UsageList({ plugin }: { plugin: PluginStatusV3 }) {
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

function LastErrorDetails({ plugin, defaultOpen = false }: { plugin: PluginStatusV3; defaultOpen?: boolean }) {
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
const FOCUSABLE = "button:not(:disabled), input:not(:disabled), summary, [tabindex]:not([tabindex='-1'])";

function BuiltinPluginCard({ plugin, hostPlugin, onSelect, onOpenPage }: {
  plugin: BuiltinPlugin; hostPlugin?: PluginStatusV3; onSelect: () => void; onOpenPage?: (page: SettingsCategory) => void;
}) {
  const settingsText = useTranslation().settings;
  const text = settingsText.pluginsV3;
  const errorText = useErrorText();
  const switchId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const essential = plugin.kind === "essential";
  const id = plugin.id as BuiltinPluginName;
  const name = (text.builtinNames as Record<string, string | undefined>)[id] ?? plugin.id;
  const Icon = (BUILTIN_ICONS as Record<string, LucideIcon | undefined>)[id] ?? Blocks;
  const state = hostPlugin ? stateOf(hostPlugin) : plugin.enabled ? "running" : "disabled";
  const tone = TONES[state];
  const summary = text.builtinNotes[id] ?? text.builtinSummaries[id] ?? "";
  const note = error ?? (essential ? `${text.essentialNote} · ${summary}` : summary);
  const hostDetail = hostPlugin ? detailText(hostPlugin, text) : null;
  const showStateBadge = state !== "running" && state !== "disabled";
  const usage = hostPlugin?.usage;
  const targetPage = BUILTIN_PAGES[id];
  const change = (enabled: boolean) => {
    setBusy(true);
    setError(null);
    void switchBuiltinPlugin(plugin.id, enabled).catch((failure: unknown) => setError(errorText(failure))).finally(() => setBusy(false));
  };
  const openCard = (event: MouseEvent<HTMLElement>) => {
    if (!(event.target as Element).closest(INTERACTIVE)) onSelect();
  };
  return (
    <article
      className={`plugins-v3__card plugins-v3__builtin${hostPlugin ? ` plugins-v3__plugin plugins-v3__plugin--${tone}` : ""}${plugin.enabled ? "" : " plugins-v3__card--off"}`}
      data-builtin={plugin.id}
      data-enabled={plugin.enabled}
      data-plugin={hostPlugin ? plugin.id : undefined}
      data-state={hostPlugin ? state : undefined}
      onClick={openCard}
    >
      <div className="plugins-v3__plugin-head">
        <span className={`plugins-v3__icon plugins-v3__icon--${tone}`} aria-hidden="true"><Icon size={16} strokeWidth={2} /><span className="plugins-v3__dot" /></span>
        <div className="plugins-v3__title-col">
          <div className="plugins-v3__title-line">
            <label className="plugins-v3__plugin-name" htmlFor={switchId} title={name}>{name}</label>
            {essential ? <span className="plugins-v3__kind">{text.kinds.essential}</span> : null}
            {showStateBadge ? <span className="plugins-v3__state">{text.states[state]}</span> : null}
          </div>
          <span className="plugins-v3__id">{plugin.id}</span>
        </div>
        <div className="plugins-v3__switch"><SettingsSwitch id={switchId} checked={plugin.enabled} disabled={essential || busy} onChange={change} /></div>
      </div>
      {note ? <p className="plugins-v3__note">{note}</p> : null}
      {hostDetail ? <p className={`plugins-v3__detail plugins-v3__detail--${tone}`}>{hostDetail}</p> : null}
      <div className="plugins-v3__card-foot">
        {usage && plugin.enabled && state === "running" ? (
          <span>{`${text.cpu} ${milliseconds(usage.cpuMs)} · ${text.apply} ${usage.applyMs === null ? "–" : milliseconds(usage.applyMs)}`}</span>
        ) : (
          <span className={`plugins-v3__foot-state plugins-v3__foot-state--${tone}`}>{text.states[state]}</span>
        )}
        <span className="plugins-v3__foot-actions">
          <button className="plugins-v3__foot-btn" type="button" onClick={onSelect}>
            {usage && plugin.enabled && state === "running" ? resourceSummary(hostPlugin, text) : text.viewDetail}
          </button>
          {targetPage && onOpenPage && plugin.enabled ? (
            <button className="plugins-v3__foot-link" type="button" onClick={() => onOpenPage(targetPage)}>{settingsText.shortcuts.openFeaturePage}</button>
          ) : null}
        </span>
      </div>
    </article>
  );
}

export function HostPluginCard({ plugin, onSelect }: { plugin: PluginStatusV3; onSelect?: () => void }) {
  const text = useTranslation().settings.pluginsV3;
  const state = stateOf(plugin);
  const tone = TONES[state];
  const detail = detailText(plugin, text);
  const openCard = (event: MouseEvent<HTMLElement>) => {
    if (onSelect && !(event.target as Element).closest(INTERACTIVE)) onSelect();
  };
  return (
    <article className={`plugins-v3__card plugins-v3__plugin plugins-v3__plugin--${tone}`} data-plugin={plugin.id} data-state={state} onClick={openCard}>
      <div className="plugins-v3__plugin-head">
        <span className={`plugins-v3__icon plugins-v3__icon--${tone}`} aria-hidden="true">
          <Blocks size={16} strokeWidth={2} />
          <span className="plugins-v3__dot" />
        </span>
        <div className="plugins-v3__title-col">
          <div className="plugins-v3__title-line">
            <span className="plugins-v3__plugin-name" title={plugin.name}>{plugin.id}</span>
            {plugin.kind ? <span className="plugins-v3__kind">{text.kinds[plugin.kind]}</span> : null}
            {plugin.source === "manual" && text.unreviewedBadge ? <span className="plugins-v3__kind">{text.unreviewedBadge}</span> : null}
            <span className="plugins-v3__state">{text.states[state]}</span>
          </div>
          {plugin.name && plugin.name !== plugin.id ? <span className="plugins-v3__id">{plugin.name}</span> : null}
        </div>
      </div>
      {detail ? <p className={`plugins-v3__detail plugins-v3__detail--${tone}`}>{detail}</p> : null}
      <UsageList plugin={plugin} />
      <LastErrorDetails plugin={plugin} />
    </article>
  );
}

export function PluginDetailModal({ builtin, hostPlugin, hostPlugins, builtins, onClose, onOpenPage }: {
  builtin?: BuiltinPlugin; hostPlugin?: PluginStatusV3; hostPlugins?: readonly PluginStatusV3[] | null;
  builtins?: readonly BuiltinPlugin[] | null; onClose: () => void; onOpenPage?: (page: SettingsCategory) => void;
}) {
  const settingsText = useTranslation().settings;
  const text = settingsText.pluginsV3;
  const switchId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => before?.focus();
  }, []);

  if (!builtin && !hostPlugin) return null;
  const id = builtin?.id ?? hostPlugin!.id;
  const name = (text.builtinNames as Record<string, string | undefined>)[id] ?? hostPlugin?.name ?? id;
  const Icon = (BUILTIN_ICONS as Record<string, LucideIcon | undefined>)[id] ?? Blocks;
  const kind = builtin?.kind ?? hostPlugin?.kind;
  const state = hostPlugin ? stateOf(hostPlugin) : builtin?.enabled ? "running" : "disabled";
  const tone = TONES[state];
  const detail = hostPlugin ? detailText(hostPlugin, text, hostPlugins, builtins) : null;
  const summary = (text.builtinNotes as Record<string, string | undefined>)[id] ?? (text.builtinSummaries as Record<string, string | undefined>)[id] ?? null;
  const note = builtin?.kind === "essential" ? `${text.essentialNote}${summary ? ` · ${summary}` : ""}` : summary;
  const targetPage = builtin ? BUILTIN_PAGES[builtin.id as BuiltinPluginName] : undefined;
  const toggle = (enabled: boolean) => {
    if (!builtin) return;
    setBusy(true);
    void switchBuiltinPlugin(builtin.id, enabled).finally(() => setBusy(false));
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") return (event.stopPropagation(), onClose());
    if (event.key !== "Tab") return;
    const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter((el) => el.offsetParent !== null);
    if (items.length === 0) return;
    const [first, last] = [items[0], items[items.length - 1]];
    if (event.shiftKey && document.activeElement === first) (event.preventDefault(), last.focus());
    else if (!event.shiftKey && document.activeElement === last) (event.preventDefault(), first.focus());
  };

  return createPortal(
    <div className="plugins-v3__modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className={`plugins-v3__modal plugins-v3__plugin--${tone}`} role="dialog" aria-modal="true" aria-label={name} onKeyDown={onKeyDown}>
        <div className="plugins-v3__modal-head">
          <span className={`plugins-v3__icon plugins-v3__icon--lg plugins-v3__icon--${tone}`} aria-hidden="true"><Icon size={18} strokeWidth={2} /><span className="plugins-v3__dot" /></span>
          <div className="plugins-v3__title-col">
            <div className="plugins-v3__title-line">
              <strong className="plugins-v3__modal-title">{name}</strong>
              {kind ? <span className="plugins-v3__kind">{text.kinds[kind]}</span> : null}
              {hostPlugin?.source === "manual" && text.unreviewedBadge ? <span className="plugins-v3__kind">{text.unreviewedBadge}</span> : null}
              <span className="plugins-v3__state">{text.states[state]}</span>
            </div>
            <span className="plugins-v3__id">{id}</span>
          </div>
          {targetPage && onOpenPage ? <SettingsLinkButton onClick={() => { onClose(); onOpenPage(targetPage); }}>{settingsText.shortcuts.openFeaturePage}</SettingsLinkButton> : null}
          {builtin ? <div className="plugins-v3__switch"><SettingsSwitch id={switchId} checked={builtin.enabled} disabled={builtin.kind === "essential" || busy} onChange={toggle} /></div> : null}
          <button ref={closeRef} className="plugins-v3__modal-close" type="button" aria-label={text.closeDetail} title={text.closeDetail} onClick={onClose}><X size={15} strokeWidth={2.2} aria-hidden="true" /></button>
        </div>
        {note ? <p className="plugins-v3__note">{note}</p> : null}
        {detail ? <p className={`plugins-v3__detail plugins-v3__detail--${tone}`}>{detail}</p> : null}
        {hostPlugin ? <LastErrorDetails plugin={hostPlugin} defaultOpen /> : null}
        {hostPlugin?.usage ? <><UsageList plugin={hostPlugin} /><SettingsFootnote text={text.cpuNote} /></> : null}
      </div>
    </div>,
    document.querySelector(".settings-stage") ?? document.getElementById("page") ?? document.body,
  );
}

export function BuiltinPluginsGroup({
  builtins, hostPlugins = null, hostEnabled = null, stale = false, query = "", onSelectPlugin, onOpenPage,
}: {
  builtins: readonly BuiltinPlugin[] | null;
  hostPlugins?: PluginStatusV3[] | null;
  hostEnabled?: boolean | null;
  stale?: boolean;
  query?: string;
  onSelectPlugin: (id: string) => void;
  onOpenPage?: (page: SettingsCategory) => void;
}) {
  const text = useTranslation().settings.pluginsV3;
  const [filter, setFilter] = useState<PluginV3Filter>("all");
  const builtinIds = new Set(builtins?.map((item) => item.id) ?? []);
  const hostById = new Map((hostPlugins ?? []).map((item) => [item.id, item]));
  const extraPlugins = (hostPlugins ?? []).filter((item) => !builtinIds.has(item.id));

  const list = builtins ?? [];
  const allTotal = list.length + extraPlugins.length;
  const coreCount = list.filter((b) => (BUILTIN_GROUPS[b.id as BuiltinPluginName] ?? "core") === "core").length;
  const aiCount = list.filter((b) => BUILTIN_GROUPS[b.id as BuiltinPluginName] === "ai").length;
  const systemCount = list.filter((b) => BUILTIN_GROUPS[b.id as BuiltinPluginName] === "system").length;
  const attentionCount = list.filter((b) => { const h = hostById.get(b.id); return h ? isAttentionState(stateOf(h)) : false; }).length + extraPlugins.filter((p) => isAttentionState(stateOf(p))).length;
  const offCount = list.filter((b) => !b.enabled).length + extraPlugins.filter((p) => stateOf(p) === "disabled").length;

  const counts: Record<PluginV3Filter, number> = {
    all: allTotal, core: coreCount, ai: aiCount, system: systemCount,
    "third-party": extraPlugins.length, attention: attentionCount, off: offCount,
  };
  const activeFilter: PluginV3Filter = counts[filter] === 0 && filter !== "all" ? "all" : filter;

  const matchBuiltin = (item: BuiltinPlugin) => {
    const id = item.id as BuiltinPluginName;
    const group = BUILTIN_GROUPS[id] ?? "core";
    const hostItem = hostById.get(item.id);
    const state = hostItem ? stateOf(hostItem) : item.enabled ? "running" : "disabled";
    if ((activeFilter === "core" || activeFilter === "ai" || activeFilter === "system") && group !== activeFilter) return false;
    if (activeFilter === "third-party") return false;
    if (activeFilter === "off" && item.enabled) return false;
    if (activeFilter === "attention" && !isAttentionState(state)) return false;
    return matchesPluginQuery(item.id, query);
  };

  const matchExtra = (item: PluginStatusV3) => {
    const state = stateOf(item);
    if (activeFilter === "core" || activeFilter === "ai" || activeFilter === "system") return false;
    if (activeFilter === "off" && state !== "disabled") return false;
    if (activeFilter === "attention" && !isAttentionState(state)) return false;
    return matchesPluginQuery(item.id, query, item.name);
  };

  const filterButtons: [PluginV3Filter, number][] = [
    ["all", allTotal], ["core", coreCount], ["ai", aiCount], ["system", systemCount],
    ...(extraPlugins.length > 0 ? ([["third-party", extraPlugins.length]] as [PluginV3Filter, number][]) : []),
    ...(attentionCount > 0 ? ([["attention", attentionCount]] as [PluginV3Filter, number][]) : []),
    ...(offCount > 0 ? ([["off", offCount]] as [PluginV3Filter, number][]) : []),
  ];

  const filteredBuiltins = list.filter(matchBuiltin);
  const filteredExtras = extraPlugins.filter(matchExtra);

  return (
    <div className={`plugins-v3__body plugins-v3__list${stale ? " plugins-v3__list--stale" : ""}`}>
      <div className="plugins-v3__filters" role="group" aria-label={text.plugins}>
        {filterButtons.map(([key, count]) => (
          <button key={key} className="plugins-v3__filter" type="button" aria-pressed={activeFilter === key} onClick={() => setFilter(activeFilter === key ? "all" : key)}>
            {text.filters[key](count)}
          </button>
        ))}
      </div>
      {hostEnabled === true && hostPlugins === null ? <p className="plugins-v3__empty">{text.waitingHost}</p> : null}
      {hostEnabled === true && hostPlugins !== null && hostPlugins.length === 0 ? <p className="plugins-v3__empty">{text.empty}</p> : null}
      {filteredExtras.length > 0 ? (
        <section className="plugins-v3__section settings-group" aria-label={text.groups["third-party"]}>
          <h3 className="plugins-v3__section-title">{text.groups["third-party"]}</h3>
          <div className="plugins-v3__grid">
            {filteredExtras.map((plugin) => <HostPluginCard key={plugin.id} plugin={plugin} onSelect={() => onSelectPlugin(plugin.id)} />)}
          </div>
        </section>
      ) : null}
      {builtins === null ? (
        <p className="plugins-v3__empty">{text.builtinsLoading}</p>
      ) : (
        (["core", "ai", "system"] as const).map((groupKey) => {
          const items = filteredBuiltins.filter((b) => (BUILTIN_GROUPS[b.id as BuiltinPluginName] ?? "core") === groupKey);
          if (items.length === 0) return null;
          return (
            <section key={groupKey} className="plugins-v3__section settings-group" aria-label={text.groups[groupKey]}>
              <h3 className="plugins-v3__section-title">{text.groups[groupKey]}</h3>
              <div className="plugins-v3__grid">
                {items.map((plugin) => <BuiltinPluginCard key={plugin.id} plugin={plugin} hostPlugin={hostById.get(plugin.id)} onSelect={() => onSelectPlugin(plugin.id)} onOpenPage={onOpenPage} />)}
              </div>
            </section>
          );
        })
      )}
      {builtins !== null && filteredBuiltins.length === 0 && filteredExtras.length === 0 ? <p className="plugins-v3__empty">{text.noMatches}</p> : null}
      <div className="plugins-v3__footnotes">
        <SettingsFootnote text={text.builtinsNote} />
        <SettingsFootnote text={text.cpuNote} />
        <SettingsFootnote text={text.preview} />
      </div>
    </div>
  );
}
