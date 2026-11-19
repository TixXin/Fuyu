import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Store, Trash2, X } from "lucide-react";
import { useErrorText, useTranslation } from "../../i18n";
import { PluginEnableSwitch, PluginRowNote, type RowAction } from "./InstalledPluginRow";
import { OfficialMark } from "./OfficialMark";
import { PluginLogo } from "./PluginLogo";
import { PluginActivityTab, PluginCommandsTab, PluginOverviewExtras, PluginSettingsTab } from "./PluginDetailTabs";
import type { InstalledEntry } from "./pluginEntries";
import { marketClient } from "./pluginMarketActions";
import type { PluginDetailTab } from "./pluginPageHandoff";
import { detailText } from "./pluginServiceStatus";
import "./PluginDetailModal.css";
import "./InstalledPlugins.css";

const FOCUSABLE = "button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], summary, [tabindex]:not([tabindex='-1'])";
const TABS: readonly PluginDetailTab[] = ["overview", "settings", "commands", "activity"];

export function PluginDetailModal({ entry, initialTab = "overview", startUninstall = false, stale, onClose, onAction, onOpenShortcuts }: {
  entry: InstalledEntry;
  initialTab?: PluginDetailTab;
  startUninstall?: boolean;
  stale: boolean;
  onClose: () => void;
  onAction: (action: RowAction) => void;
  onOpenShortcuts?: () => void;
}) {
  const t = useTranslation().settings.pluginsV3;
  const text = t.page;
  const errorText = useErrorText();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<PluginDetailTab>(initialTab);
  const [confirming, setConfirming] = useState(startUninstall);
  const [removeData, setRemoveData] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => before?.focus();
  }, []);

  const { status } = entry;
  const technical = detailText(entry.plugin, t);
  const facts: [string, string][] = [
    [text.detail.facts.version, entry.version ? `v${entry.version}` : "–"],
    [text.detail.facts.source, text.sources[entry.source]],
    ...(entry.publisher ? [[text.detail.facts.publisher, entry.publisher] as [string, string]] : []),
    [text.detail.facts.state, status.label ? text.labels[status.label] : text.running],
    [text.detail.facts.id, entry.id],
  ];

  const uninstall = () => {
    setBusy(true);
    setError(null);
    void marketClient
      .uninstall({ id: entry.id, removeData })
      .then(onClose)
      .catch((failure: unknown) => setError(errorText(failure)))
      .finally(() => setBusy(false));
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

  const onTabKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const index = TABS.indexOf(tab);
    const next = TABS[(index + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    setTab(next);
    const list = event.currentTarget;
    requestAnimationFrame(() => list.querySelector<HTMLButtonElement>(`[data-tab='${next}']`)?.focus());
  };

  return createPortal(
    <div className="plugin-dialog__backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <div ref={dialogRef} className="plugin-dialog" role="dialog" aria-modal="true" aria-label={entry.title} data-plugin-detail={entry.id} onKeyDown={onKeyDown}>
        <div className="plugin-dialog__head">
          <PluginLogo sources={entry.icons} title={entry.title} size="lg" dim={status.dot !== "ok"}>
            <span className={`plugin-icon__dot plugin-icon__dot--${status.dot}`} />
          </PluginLogo>
          <div className="plugin-dialog__heading">
            <div className="plugin-row__line plugin-row__line--wrap">
              <span className="plugin-dialog__title">{entry.title}</span>
              {entry.source === "official" ? <OfficialMark /> : null}
              {entry.source === "manual" ? <span className="plugin-badge plugin-badge--warn">{text.badges.unreviewed}</span> : null}
            </div>
            <span className="plugin-dialog__sub">
              {[entry.publisher, entry.version ? `v${entry.version}` : null, status.label ? text.labels[status.label] : text.running].filter(Boolean).join(" · ")}
            </span>
          </div>
          <div className="plugin-dialog__head-actions">
            <PluginEnableSwitch entry={entry} stale={stale} />
            <button ref={closeRef} className="plugin-icon-btn" type="button" aria-label={text.detail.close} title={text.detail.close} disabled={busy} onClick={onClose}>
              <X size={15} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="plugin-tabs" role="tablist" onKeyDown={onTabKey}>
          {TABS.map((key) => (
            <button key={key} className="plugin-tabs__tab" type="button" role="tab" data-tab={key} aria-selected={tab === key} tabIndex={tab === key ? 0 : -1} onClick={() => setTab(key)}>
              {text.detail.tabs[key]}
            </button>
          ))}
        </div>
        <div className="plugin-dialog__body" role="tabpanel" data-panel={tab}>
          {tab === "overview" ? (
            <>
              {status.note ? <PluginRowNote note={status.note} onAction={onAction} full /> : null}
              {entry.description ? <p className="plugin-dialog__desc">{entry.description}</p> : null}
              <div className="plugin-facts">
                {facts.map(([label, value]) => (
                  <div key={label}><span>{label}</span><b title={value}>{value}</b></div>
                ))}
              </div>
              {technical ? (
                <p className="plugin-callout"><b>{text.detail.technical}</b> {technical}</p>
              ) : null}
              <PluginOverviewExtras entry={entry} />
            </>
          ) : tab === "settings" ? (
            <PluginSettingsTab entry={entry} />
          ) : tab === "commands" ? (
            <PluginCommandsTab entry={entry} stale={stale} onOpenShortcuts={onOpenShortcuts} />
          ) : (
            <PluginActivityTab entry={entry} restartDisabled={stale || !entry.managed || !entry.enabled} onRestart={() => onAction("restart")} />
          )}
        </div>
        <div className="plugin-dialog__foot">
          {confirming ? (
            <div className="plugin-callout plugin-callout--bad plugin-dialog__confirm" data-uninstall-confirm>
              <Trash2 size={15} strokeWidth={2.2} aria-hidden="true" />
              <div>
                <b>{text.detail.uninstallPrompt(entry.title)}</b> {text.detail.uninstallNote}
                <label className="plugin-check">
                  <input type="checkbox" checked={removeData} disabled={busy} onChange={(event) => setRemoveData(event.currentTarget.checked)} />
                  <span>{text.detail.removeData}</span>
                </label>
                {error ? <p className="plugin-dialog__error">{error}</p> : null}
                <div className="plugin-detail__buttons">
                  <button className="plugin-btn plugin-btn--sm" type="button" disabled={busy} onClick={() => setConfirming(false)}>{text.detail.cancel}</button>
                  <button className="plugin-btn plugin-btn--sm plugin-btn--danger-solid" type="button" disabled={busy} data-action="confirm-uninstall-plugin" onClick={uninstall}>
                    {busy ? text.detail.uninstalling : text.detail.confirmUninstall}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {entry.market ? (
                <button className="plugin-btn plugin-btn--sm plugin-btn--ghost" type="button" data-action="view-in-market" onClick={() => onAction("whatsNew")}>
                  <Store size={13} strokeWidth={2.2} aria-hidden="true" />
                  {text.detail.viewInMarket}
                </button>
              ) : null}
              <span className="plugin-dialog__grow" />
              {entry.managed ? (
                <button className="plugin-btn plugin-btn--sm plugin-btn--danger" type="button" data-action="uninstall-plugin" disabled={stale} onClick={() => setConfirming(true)}>
                  <Trash2 size={13} strokeWidth={2.2} aria-hidden="true" />
                  {text.detail.uninstall}
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>,
    document.querySelector(".settings-stage") ?? document.getElementById("page") ?? document.body,
  );
}
