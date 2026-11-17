import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import {
  Blocks, Bot, Calendar, Camera, CircleDot, ClipboardList, Crop, Gauge, Headphones, Inbox,
  Languages, ListTodo, MessageCircle, Mic, Music, Plug, RefreshCw, Smartphone, Sparkles,
  Store, Timer, Volume2, Waypoints, X, type LucideIcon,
} from "lucide-react";
import { useErrorText, useTranslation } from "../../i18n";
import type { BuiltinPluginName, PluginV3Filter, PluginV3Group, PluginV3State } from "../../i18n/sections/settings/pluginsV3";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import type { BuiltinPlugin } from "../../features/plugin-kernel/api";
import { switchBuiltinPlugin } from "../../features/plugin-kernel/builtinSwitches";
import type { PluginStatusV3 } from "./usePluginHostStatus";

const STATES: readonly PluginV3State[] = ["running", "waiting", "failed", "disabled", "auto-disabled", "safe-mode", "loading", "stopped", "unloading"];

export const TONES: Record<PluginV3State, string> = {
  running: "ok", waiting: "warn", loading: "warn", failed: "bad",
  "auto-disabled": "bad", "safe-mode": "info", disabled: "off", stopped: "off", unloading: "off",
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

export function stateOf(plugin: PluginStatusV3): PluginV3State {
  return (STATES as readonly string[]).includes(plugin.state) ? (plugin.state as PluginV3State) : "loading";
}

export function milliseconds(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(ms < 10 ? 2 : ms < 100 ? 1 : 0)} ms`;
}

export function detailText(plugin: PluginStatusV3, text: ReturnType<typeof useTranslation>["settings"]["pluginsV3"]): string | null {
  const state = stateOf(plugin);
  const blocked = plugin.blocked;
  return state === "waiting" && plugin.waitingFor?.length
    ? text.waitingFor(plugin.waitingFor.join(", "))
    : blocked?.by === "errors"
      ? text.autoDisabled(blocked.errors, Math.round(blocked.windowMs / 1000))
      : blocked?.by === "safe-mode"
        ? text.heldBySafeMode(text.safeModes[blocked.mode])
        : plugin.reason ?? plugin.error ?? null;
}

export function isAttentionState(state: PluginV3State): boolean {
  return state === "failed" || state === "auto-disabled" || state === "safe-mode" || state === "waiting";
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

function BuiltinPluginCard({ plugin, hostPlugin, onSelect }: { plugin: BuiltinPlugin; hostPlugin?: PluginStatusV3; onSelect: () => void }) {
  const text = useTranslation().settings.pluginsV3;
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
  const change = (enabled: boolean) => {
    setBusy(true);
    setError(null);
    void switchBuiltinPlugin(plugin.id, enabled)
      .catch((failure: unknown) => setError(errorText(failure)))
      .finally(() => setBusy(false));
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
        <span className={`plugins-v3__icon plugins-v3__icon--${tone}`} aria-hidden="true">
          <Icon size={16} strokeWidth={2} />
          <span className="plugins-v3__dot" />
        </span>
        <div className="plugins-v3__title-col">
          <div className="plugins-v3__title-line">
            <label className="plugins-v3__plugin-name" htmlFor={switchId} title={name}>{name}</label>
            {essential ? <span className="plugins-v3__kind">{text.kinds.essential}</span> : null}
            {showStateBadge ? <span className="plugins-v3__state">{text.states[state]}</span> : null}
          </div>
          <span className="plugins-v3__id">{plugin.id}</span>
        </div>
        <div className="plugins-v3__switch">
          <SettingsSwitch id={switchId} checked={plugin.enabled} disabled={essential || busy} onChange={change} />
        </div>
      </div>
      {note ? <p className="plugins-v3__note">{note}</p> : null}
      {hostDetail ? <p className={`plugins-v3__detail plugins-v3__detail--${tone}`}>{hostDetail}</p> : null}
      <div className="plugins-v3__card-foot">
        {usage && plugin.enabled && state === "running" ? (
          <>
            <span>{`${text.cpu} ${milliseconds(usage.cpuMs)} · ${text.apply} ${usage.applyMs === null ? "–" : milliseconds(usage.applyMs)}`}</span>
            <span>{resourceSummary(hostPlugin, text)}</span>
          </>
        ) : (
          <>
            <span className={`plugins-v3__foot-state plugins-v3__foot-state--${tone}`}>{text.states[state]}</span>
            <span>{text.viewDetail}</span>
          </>
        )}
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

export function PluginDetailModal({ builtin, hostPlugin, onClose }: { builtin?: BuiltinPlugin; hostPlugin?: PluginStatusV3; onClose: () => void }) {
  const text = useTranslation().settings.pluginsV3;
  const switchId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!builtin && !hostPlugin) return null;
  const id = builtin?.id ?? hostPlugin!.id;
  const builtinId = id as BuiltinPluginName;
  const name = (text.builtinNames as Record<string, string | undefined>)[id] ?? hostPlugin?.name ?? id;
  const Icon = (BUILTIN_ICONS as Record<string, LucideIcon | undefined>)[id] ?? Blocks;
  const kind = builtin?.kind ?? hostPlugin?.kind;
  const state = hostPlugin ? stateOf(hostPlugin) : builtin?.enabled ? "running" : "disabled";
  const tone = TONES[state];
  const detail = hostPlugin ? detailText(hostPlugin, text) : null;
  const summary = (text.builtinNotes as Record<string, string | undefined>)[id] ?? (text.builtinSummaries as Record<string, string | undefined>)[id] ?? null;
  const note = builtin?.kind === "essential" ? `${text.essentialNote}${summary ? ` · ${summary}` : ""}` : summary;
  const toggle = (enabled: boolean) => {
    if (!builtin) return;
    setBusy(true);
    void switchBuiltinPlugin(builtin.id, enabled).finally(() => setBusy(false));
  };

  return createPortal(
    <div className="plugins-v3__modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`plugins-v3__modal plugins-v3__plugin--${tone}`} role="dialog" aria-modal="true" aria-label={name}>
        <div className="plugins-v3__modal-head">
          <span className={`plugins-v3__icon plugins-v3__icon--lg plugins-v3__icon--${tone}`} aria-hidden="true">
            <Icon size={18} strokeWidth={2} />
            <span className="plugins-v3__dot" />
          </span>
          <div className="plugins-v3__title-col">
            <div className="plugins-v3__title-line">
              <strong className="plugins-v3__modal-title">{name}</strong>
              {kind ? <span className="plugins-v3__kind">{text.kinds[kind]}</span> : null}
              <span className="plugins-v3__state">{text.states[state]}</span>
            </div>
            <span className="plugins-v3__id">{builtinId}</span>
          </div>
          {builtin ? (
            <div className="plugins-v3__switch">
              <SettingsSwitch id={switchId} checked={builtin.enabled} disabled={builtin.kind === "essential" || busy} onChange={toggle} />
            </div>
          ) : null}
          <button ref={closeRef} className="plugins-v3__modal-close" type="button" aria-label={text.closeDetail} title={text.closeDetail} onClick={onClose}>
            <X size={15} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
        {note ? <p className="plugins-v3__note">{note}</p> : null}
        {detail ? <p className={`plugins-v3__detail plugins-v3__detail--${tone}`}>{detail}</p> : null}
        {hostPlugin ? <LastErrorDetails plugin={hostPlugin} defaultOpen /> : null}
        {hostPlugin ? <UsageList plugin={hostPlugin} /> : null}
        <SettingsFootnote text={text.cpuNote} />
      </div>
    </div>,
    document.querySelector(".settings-stage") ?? document.getElementById("page") ?? document.body,
  );
}

export function BuiltinPluginsGroup({
  builtins, hostPlugins = null, hostEnabled = null, stale = false, query = "", onSelectPlugin,
}: {
  builtins: readonly BuiltinPlugin[] | null;
  hostPlugins?: PluginStatusV3[] | null;
  hostEnabled?: boolean | null;
  stale?: boolean;
  query?: string;
  onSelectPlugin: (id: string) => void;
}) {
  const text = useTranslation().settings.pluginsV3;
  const [filter, setFilter] = useState<PluginV3Filter>("all");
  const builtinIds = new Set(builtins?.map((item) => item.id) ?? []);
  const hostById = new Map((hostPlugins ?? []).map((item) => [item.id, item]));
  const extraPlugins = (hostPlugins ?? []).filter((item) => !builtinIds.has(item.id));
  const q = query.trim().toLowerCase();

  const matchBuiltin = (item: BuiltinPlugin) => {
    const id = item.id as BuiltinPluginName;
    const group = BUILTIN_GROUPS[id] ?? "core";
    const hostItem = hostById.get(item.id);
    const state = hostItem ? stateOf(hostItem) : item.enabled ? "running" : "disabled";
    if ((filter === "core" || filter === "ai" || filter === "system") && group !== filter) return false;
    if (filter === "third-party") return false;
    if (filter === "off" && item.enabled) return false;
    if (filter === "attention" && !isAttentionState(state)) return false;
    if (!q) return true;
    const name = (text.builtinNames as Record<string, string | undefined>)[id] ?? item.id;
    const note = text.builtinNotes[id] ?? text.builtinSummaries[id] ?? "";
    return name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q) || note.toLowerCase().includes(q);
  };

  const matchExtra = (item: PluginStatusV3) => {
    const state = stateOf(item);
    if (filter === "core" || filter === "ai" || filter === "system") return false;
    if (filter === "off" && state !== "disabled") return false;
    if (filter === "attention" && !isAttentionState(state)) return false;
    return !q || item.id.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
  };

  const list = builtins ?? [];
  const allTotal = list.length + extraPlugins.length;
  const coreCount = list.filter((b) => (BUILTIN_GROUPS[b.id as BuiltinPluginName] ?? "core") === "core").length;
  const aiCount = list.filter((b) => BUILTIN_GROUPS[b.id as BuiltinPluginName] === "ai").length;
  const systemCount = list.filter((b) => BUILTIN_GROUPS[b.id as BuiltinPluginName] === "system").length;
  const attentionCount = list.filter((b) => { const h = hostById.get(b.id); return h ? isAttentionState(stateOf(h)) : false; }).length + extraPlugins.filter((p) => isAttentionState(stateOf(p))).length;
  const offCount = list.filter((b) => !b.enabled).length + extraPlugins.filter((p) => stateOf(p) === "disabled").length;

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
          <button key={key} className="plugins-v3__filter" type="button" aria-pressed={filter === key} onClick={() => setFilter(filter === key ? "all" : key)}>
            {text.filters[key](count)}
          </button>
        ))}
      </div>
      {hostEnabled === true && hostPlugins === null ? <p className="plugins-v3__empty">{text.waitingHost}</p> : null}
      {hostEnabled === true && hostPlugins !== null && hostPlugins.length === 0 ? <p className="plugins-v3__empty">{text.empty}</p> : null}
      {filteredExtras.length > 0 ? (
        <section className="plugins-v3__section" aria-label={text.groups["third-party"]}>
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
            <section key={groupKey} className="plugins-v3__section" aria-label={text.groups[groupKey]}>
              <h3 className="plugins-v3__section-title">{text.groups[groupKey]}</h3>
              <div className="plugins-v3__grid">
                {items.map((plugin) => <BuiltinPluginCard key={plugin.id} plugin={plugin} hostPlugin={hostById.get(plugin.id)} onSelect={() => onSelectPlugin(plugin.id)} />)}
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
