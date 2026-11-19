import { useId, useState, type MouseEvent, type ReactNode } from "react";
import { Activity, AlertCircle, Download, Info, KeyRound, RotateCcw, Settings, ShieldAlert, Store, Trash2 } from "lucide-react";
import { useErrorText, useTranslation } from "../../i18n";
import type { SettingsPluginPageText } from "../../i18n/sections/settings/pluginPage";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import type { InstalledEntry } from "./pluginEntries";
import { marketClient } from "./pluginMarketActions";
import { PluginMenu, type PluginMenuItem } from "./PluginMenu";
import type { RowNote } from "./pluginRowStatus";

export type RowAction = "restart" | "log" | "turnOnProvider" | "uninstall" | "review" | "update" | "whatsNew";

const INTERACTIVE = "button, input, label, a, .settings-switch";

const NOTE_TONES: Record<RowNote["kind"], "bad" | "warn" | "info"> = {
  failed: "bad", paused: "bad", waiting: "info", revoked: "bad", trust: "warn", update: "info",
};

export function pluginInitial(title: string): string {
  return (Array.from(title.replace(/^@[^/]+\//, "").trim())[0] ?? "?").toUpperCase();
}

export function useNoteParts(note: RowNote): { text: string; icon: ReactNode; actions: [RowAction, string, boolean][] } {
  const t = useTranslation().settings.pluginsV3;
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
    case "revoked":
      return { text: page.notes.revoked, icon: <ShieldAlert size={13} strokeWidth={2.2} />, actions: [["uninstall", page.actions.uninstall, false]] };
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
    </div>
  );
}

export function PluginEnableSwitch({ entry, stale }: { entry: InstalledEntry; stale: boolean }) {
  const text = useTranslation().settings.pluginsV3.page;
  const errorText = useErrorText();
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!entry.managed) return null;
  const toggle = (enabled: boolean) => {
    setBusy(true);
    setError(null);
    void marketClient
      .setEnabled({ id: entry.id, enabled })
      .catch((failure: unknown) => setError(errorText(failure)))
      .finally(() => setBusy(false));
  };
  return (
    <span className="plugin-row__switch" title={error ?? undefined} data-error={error ? "true" : undefined}>
      <SettingsSwitch id={id} checked={entry.enabled} disabled={busy || stale} ariaLabel={text.actions.enabled(entry.title)} onChange={toggle} />
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

export function InstalledPluginRow({ entry, stale, onOpen, onAction }: {
  entry: InstalledEntry;
  stale: boolean;
  onOpen: (tab?: "overview" | "settings") => void;
  onAction: (action: RowAction) => void;
}) {
  const text = useTranslation().settings.pluginsV3.page;
  const { status } = entry;
  const facts = [entry.publisher, text.sources[entry.source]].filter(Boolean).join(" · ");
  const open = (event: MouseEvent<HTMLElement>) => {
    if (!(event.target as Element).closest(INTERACTIVE)) onOpen();
  };
  const labelTone = status.dot === "bad" ? " plugin-row__state--bad" : status.dot === "wait" ? " plugin-row__state--wait" : "";
  return (
    <div className={`plugin-row${entry.enabled ? "" : " plugin-row--off"}`} data-plugin={entry.id} data-dot={status.dot} onClick={open}>
      <span className={`plugin-icon${status.dot === "ok" ? "" : " plugin-icon--dim"}`} aria-hidden="true">
        {pluginInitial(entry.title)}
        <span className={`plugin-icon__dot plugin-icon__dot--${status.dot}`} />
      </span>
      <div className="plugin-row__main">
        <div className="plugin-row__line">
          <button className="plugin-row__name" type="button" title={entry.title} onClick={() => onOpen()}>{entry.title}</button>
          {entry.source === "official" ? <span className="plugin-badge plugin-badge--official">{text.badges.official}</span> : null}
          {entry.source === "manual" ? <span className="plugin-badge plugin-badge--warn">{text.badges.unreviewed}</span> : null}
          {entry.version ? <span className="plugin-row__version">v{entry.version}</span> : null}
          {status.label ? <span className={`plugin-row__state${labelTone}`}>· {text.labels[status.label]}</span> : null}
        </div>
        {entry.description ? <p className="plugin-row__desc">{entry.description}</p> : null}
        {facts ? <div className="plugin-row__facts">{facts}</div> : null}
        {status.note ? <PluginRowNote note={status.note} onAction={onAction} /> : null}
      </div>
      <div className="plugin-row__aside">
        <button className="plugin-icon-btn" type="button" title={text.actions.settings} aria-label={text.actions.settings} data-action="open-settings" onClick={() => onOpen("settings")}>
          <Settings size={15} strokeWidth={2} aria-hidden="true" />
        </button>
        <PluginMenu label={text.moreActions} items={rowMenu(entry, stale, text, onAction)} />
        <PluginEnableSwitch entry={entry} stale={stale} />
      </div>
    </div>
  );
}
