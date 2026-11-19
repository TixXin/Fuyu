import { useId, useState, type MouseEvent, type ReactNode } from "react";
import { Activity, AlertCircle, Download, Info, KeyRound, RotateCcw, Settings, ShieldAlert, SlidersHorizontal, Store, Trash2 } from "lucide-react";
import type { MarketLocalizedText } from "@fuyu/plugin-services";
import { useErrorText, useLocale, useTranslation } from "../../i18n";
import type { SettingsPluginPageText } from "../../i18n/sections/settings/pluginPage";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import type { InstalledEntry } from "./pluginEntries";
import { marketClient } from "./pluginMarketActions";
import { capabilityItems, localized } from "./pluginMarketModel";
import { OfficialMark } from "./OfficialMark";
import { PluginLogo } from "./PluginLogo";
import { PluginMenu, type PluginMenuItem } from "./PluginMenu";
import { PluginPlaceTags } from "./PluginPlaceTags";
import { versionStanding } from "./pluginReach";
import type { RowNote } from "./pluginRowStatus";
import type { PluginSetupNeed } from "./pluginSetupStore";

export type RowAction = "restart" | "log" | "turnOnProvider" | "uninstall" | "review" | "update" | "whatsNew";

const INTERACTIVE = "button, input, label, a, .settings-switch";

const NOTE_TONES: Record<RowNote["kind"], "bad" | "warn" | "info"> = {
  failed: "bad", paused: "bad", waiting: "info", unreachable: "bad", revoked: "bad", warned: "warn", trust: "warn", held: "info", update: "info",
};

function reasonTexts(reasons: readonly (MarketLocalizedText | string)[], locale: string): string[] {
  return reasons.map((reason) => localized(reason, locale, "")).filter(Boolean);
}

function revokedReasons(failure: unknown): (MarketLocalizedText | string)[] | null {
  if (!failure || typeof failure !== "object" || (failure as { code?: unknown }).code !== "revoked") return null;
  const reasons = (failure as { data?: { reasons?: unknown } }).data?.reasons;
  return Array.isArray(reasons) ? reasons : [];
}

export function useNoteParts(note: RowNote): { text: string; icon: ReactNode; details?: string[]; actions: [RowAction, string, boolean][] } {
  const t = useTranslation().settings.pluginsV3;
  const { locale } = useLocale();
  const page = t.page;
  const providerName = note.kind === "waiting" && note.provider ? t.builtinNames[note.provider] : null;
  switch (note.kind) {
    case "failed":
      return { text: note.text, icon: <AlertCircle size={13} strokeWidth={2.2} />, actions: [["restart", page.actions.restart, false], ["log", page.actions.viewLog, false]] };
    case "paused":
      return { text: page.notes.paused(note.errors, note.seconds), icon: <AlertCircle size={13} strokeWidth={2.2} />, actions: [["restart", page.actions.turnBackOn, false], ["log", page.actions.viewLog, false]] };
    case "waiting":
      return {
        text: providerName ? (note.providerOff ? page.notes.waitingOff(providerName) : page.notes.waitingStarting(providerName)) : page.notes.waitingNobody,
        icon: <Info size={13} strokeWidth={2.2} />,
        actions: providerName && note.providerOff ? [["turnOnProvider", page.actions.turnOn(providerName), false]] : [],
      };
    case "unreachable":
      return { text: page.notes.unreachable(note.windows.join(", ")), icon: <AlertCircle size={13} strokeWidth={2.2} />, actions: [] };
    case "revoked":
      return { text: page.notes.revoked, icon: <ShieldAlert size={13} strokeWidth={2.2} />, details: reasonTexts(note.reasons, locale), actions: [["uninstall", page.actions.uninstall, false]] };
    case "warned":
      return { text: page.notes.warned, icon: <ShieldAlert size={13} strokeWidth={2.2} />, details: reasonTexts(note.reasons, locale), actions: note.update ? [["update", page.actions.update, false]] : [] };
    case "held": {
      const join = (list: readonly string[]) => list.join(locale === "en" ? ", " : "、");
      const details = capabilityItems(note.added).map((item) => page.notes.heldItem(t.marketPage.capabilities.titles[item.kind], join(item.detail)));
      return { text: page.notes.held(note.version), icon: <Download size={13} strokeWidth={2.2} />, details, actions: [["update", page.actions.reviewUpdate, true], ["whatsNew", page.actions.whatsNew, false]] };
    }
    case "trust":
      return { text: page.notes.trust(note.version), icon: <KeyRound size={13} strokeWidth={2.2} />, actions: [["review", page.actions.review, false]] };
    case "update":
      return note.fresh
        ? { text: page.notes.updateFresh(note.version), icon: <Download size={13} strokeWidth={2.2} />, actions: [["update", page.actions.updateNow, false]] }
        : { text: page.notes.update(note.version), icon: <Download size={13} strokeWidth={2.2} />, actions: [["update", page.actions.update, true], ["whatsNew", page.actions.whatsNew, false]] };
  }
}

export function PluginRowNote({ note, onAction, full = false }: { note: RowNote; onAction: (action: RowAction) => void; full?: boolean }) {
  const parts = useNoteParts(note);
  return (
    <div className={`plugin-note plugin-note--${NOTE_TONES[note.kind]}${full ? " plugin-note--full" : ""}`} data-note={note.kind}>
      <span className="plugin-note__text">
        <span className="plugin-note__icon" aria-hidden="true">{parts.icon}</span>
        <span>{parts.text}</span>
      </span>
      {parts.actions.length > 0 ? (
        <span className="plugin-note__actions">
          {parts.actions.map(([action, label, primary]) => (
            <button key={action} className={`plugin-btn plugin-btn--sm${primary ? " plugin-btn--primary" : ""}`} type="button" data-row-action={action} onClick={() => onAction(action)}>
              {label}
            </button>
          ))}
        </span>
      ) : null}
      {parts.details?.length ? (
        <ul className="plugin-note__list">
          {parts.details.map((line) => <li key={line}>{line}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

export function PluginSetupNote({ setup, onOpenSettings, full = false }: { setup: PluginSetupNeed; onOpenSettings: () => void; full?: boolean }) {
  const text = useTranslation().settings.pluginsV3.page.setup;
  return (
    <div className={`plugin-note plugin-note--info${full ? " plugin-note--full" : ""}`} data-note="setup">
      <span className="plugin-note__text">
        <span className="plugin-note__icon" aria-hidden="true"><SlidersHorizontal size={13} strokeWidth={2.2} /></span>
        <span>{text.note(setup.hint)}</span>
      </span>
      <span className="plugin-note__actions">
        <button className="plugin-btn plugin-btn--sm plugin-btn--primary" type="button" data-row-action="setup" onClick={onOpenSettings}>{text.go}</button>
      </span>
    </div>
  );
}

export function PluginEnableSwitch({ entry, stale }: { entry: InstalledEntry; stale: boolean }) {
  const text = useTranslation().settings.pluginsV3.page;
  const { locale } = useLocale();
  const errorText = useErrorText();
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!entry.managed) return null;
  const locked = entry.revocation?.level === "disable" && !entry.enabled;
  const explain = (failure: unknown) => {
    const reasons = revokedReasons(failure);
    if (!reasons) return errorText(failure);
    const texts = reasonTexts(reasons, locale);
    return texts.length > 0 ? text.notes.revokedError(texts.join(locale === "en" ? "; " : "；")) : text.notes.revokedSwitch;
  };
  const toggle = (enabled: boolean) => {
    setBusy(true);
    setError(null);
    void marketClient
      .setEnabled({ id: entry.id, enabled })
      .catch((failure: unknown) => setError(explain(failure)))
      .finally(() => setBusy(false));
  };
  return (
    <span className="plugin-row__switch" title={error ?? (locked ? text.notes.revokedSwitch : undefined)} data-error={error ? "true" : undefined} data-locked={locked ? "true" : undefined}>
      <SettingsSwitch id={id} checked={entry.enabled} disabled={busy || stale || locked} ariaLabel={text.actions.enabled(entry.title)} onChange={toggle} />
    </span>
  );
}

function rowMenu(entry: InstalledEntry, stale: boolean, text: SettingsPluginPageText, onAction: (action: RowAction) => void): PluginMenuItem[] {
  const items: PluginMenuItem[] = [
    { key: "restart", label: text.actions.restart, icon: <RotateCcw size={14} strokeWidth={2} />, disabled: stale || !entry.managed || !entry.enabled, onSelect: () => onAction("restart") },
    { key: "log", label: text.actions.viewLog, icon: <Activity size={14} strokeWidth={2} />, onSelect: () => onAction("log") },
  ];
  if (entry.market) items.push({ key: "market", label: text.detail.viewInMarket, icon: <Store size={14} strokeWidth={2} />, onSelect: () => onAction("whatsNew") });
  if (entry.removable) items.push({ key: "uninstall", label: entry.managed ? text.actions.uninstall : text.actions.remove, icon: <Trash2 size={14} strokeWidth={2} />, danger: true, separatorBefore: true, disabled: stale, onSelect: () => onAction("uninstall") });
  return items;
}

export function useVersionText(entry: InstalledEntry): { text: string; strong: boolean } | null {
  const versions = useTranslation().settings.pluginsV3.page.versions;
  if (!entry.version) return null;
  if (entry.source === "manual" && versionStanding(entry.version, entry.marketVersion) === "newer") return { text: versions.localNewer(entry.version), strong: true };
  return { text: `v${entry.version}`, strong: false };
}

export function useOriginText(entry: InstalledEntry): { text: string; warn: boolean } | null {
  const text = useTranslation().settings.pluginsV3.page;
  if (entry.source === "manual") return { text: text.sources.manual, warn: true };
  if (entry.source === "local") return { text: text.sources.local, warn: false };
  return entry.publisher ? { text: entry.publisher, warn: false } : null;
}

export function InstalledPluginRow({ entry, stale, onOpen, onAction }: {
  entry: InstalledEntry;
  stale: boolean;
  onOpen: (tab?: "overview" | "settings") => void;
  onAction: (action: RowAction) => void;
}) {
  const text = useTranslation().settings.pluginsV3.page;
  const { status } = entry;
  const version = useVersionText(entry);
  const origin = useOriginText(entry);
  const open = (event: MouseEvent<HTMLElement>) => {
    if (!(event.target as Element).closest(INTERACTIVE)) onOpen();
  };
  const labelTone = status.dot === "bad" ? " plugin-row__state--bad" : status.dot === "wait" ? " plugin-row__state--wait" : "";
  return (
    <div className={`plugin-row${entry.enabled ? "" : " plugin-row--off"}`} data-plugin={entry.id} data-dot={status.dot} onClick={open}>
      <PluginLogo sources={entry.icons} title={entry.title} dim={status.dot !== "ok"}>
        <span className={`plugin-icon__dot plugin-icon__dot--${status.dot}`} />
      </PluginLogo>
      <div className="plugin-row__main">
        <div className="plugin-row__line">
          <button className="plugin-row__name" type="button" title={entry.title} onClick={() => onOpen()}>{entry.title}</button>
          {entry.source === "official" ? <OfficialMark /> : null}
          {entry.source === "manual" ? <span className="plugin-badge plugin-badge--warn">{text.badges.unreviewed}</span> : null}
          {entry.setup ? <button className="plugin-badge plugin-badge--setup" type="button" data-badge="setup" title={text.setup.badgeTitle} onClick={() => onOpen("settings")}>{text.badges.setup}</button> : null}
          {version ? <span className={`plugin-row__version${version.strong ? " plugin-row__version--strong" : ""}`} title={version.text}>{version.text}</span> : null}
          {status.label ? <span className={`plugin-row__state${labelTone}`}>· {text.labels[status.label]}</span> : null}
        </div>
        {entry.description ? <p className="plugin-row__desc">{entry.description}</p> : null}
        {entry.places.length > 0 || origin ? (
          <div className="plugin-row__facts">
            <PluginPlaceTags entry={entry} stale={stale} onOpenSettings={() => onOpen("settings")} />
            {origin ? <span className={`plugin-row__origin${origin.warn ? " plugin-row__origin--warn" : ""}`} data-origin={entry.source}>{entry.places.length > 0 ? "· " : ""}{origin.text}</span> : null}
          </div>
        ) : null}
        {entry.setup ? <PluginSetupNote setup={entry.setup} onOpenSettings={() => onOpen("settings")} /> : null}
        {status.note ? <PluginRowNote note={status.note} onAction={onAction} /> : null}
      </div>
      <div className="plugin-row__aside">
        {entry.settings === false ? null : (
          <button className="plugin-icon-btn" type="button" title={text.actions.settings} aria-label={text.actions.settings} data-action="open-settings" onClick={() => onOpen("settings")}>
            <Settings size={15} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
        <PluginMenu label={text.moreActions} items={rowMenu(entry, stale, text, onAction)} />
        <PluginEnableSwitch entry={entry} stale={stale} />
      </div>
    </div>
  );
}
