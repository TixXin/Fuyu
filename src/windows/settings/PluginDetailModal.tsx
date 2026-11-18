import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Blocks, Trash2, X, type LucideIcon } from "lucide-react";
import { marketV1 } from "@fuyu/plugin-services";
import { useErrorText, useTranslation } from "../../i18n";
import type { BuiltinPluginName } from "../../i18n/sections/settings/pluginsV3";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import type { BuiltinPlugin } from "../../features/plugin-kernel/api";
import { switchBuiltinPlugin } from "../../features/plugin-kernel/builtinSwitches";
import { windowServices } from "../../features/plugin-kernel/services";
import type { SettingsCategory } from "./categories";
import {
  BUILTIN_ICONS,
  BUILTIN_PAGES,
  PluginLastErrorDetails,
  PluginUsageList,
  TONES,
  detailText,
  isManagedThirdParty,
  stateOf,
} from "./BuiltinPluginsGroup";
import type { PluginStatusV3 } from "./usePluginHostStatus";

const FOCUSABLE = "button:not(:disabled), input:not(:disabled), summary, [tabindex]:not([tabindex='-1'])";
const marketClient = windowServices.get(marketV1);

export function PluginDetailModal({
  builtin,
  hostPlugin,
  hostPlugins,
  builtins,
  onClose,
  onOpenPage,
}: {
  builtin?: BuiltinPlugin;
  hostPlugin?: PluginStatusV3;
  hostPlugins?: readonly PluginStatusV3[] | null;
  builtins?: readonly BuiltinPlugin[] | null;
  onClose: () => void;
  onOpenPage?: (page: SettingsCategory) => void;
}) {
  const settingsText = useTranslation().settings;
  const text = settingsText.pluginsV3;
  const errorText = useErrorText();
  const switchId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingUninstall, setConfirmingUninstall] = useState(false);
  const [removeData, setRemoveData] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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
  const summary =
    (text.builtinNotes as Record<string, string | undefined>)[id] ??
    (text.builtinSummaries as Record<string, string | undefined>)[id] ??
    null;
  const note = builtin?.kind === "essential" ? `${text.essentialNote}${summary ? ` · ${summary}` : ""}` : summary;
  const targetPage = builtin ? BUILTIN_PAGES[builtin.id as BuiltinPluginName] : undefined;
  const managedThirdParty = !builtin && isManagedThirdParty(hostPlugin);
  const thirdPartyEnabled = state !== "disabled";

  const toggleBuiltin = (enabled: boolean) => {
    if (!builtin) return;
    setBusy(true);
    setActionError(null);
    void switchBuiltinPlugin(builtin.id, enabled)
      .catch((failure: unknown) => setActionError(errorText(failure)))
      .finally(() => setBusy(false));
  };

  const toggleThirdParty = (enabled: boolean) => {
    if (!hostPlugin) return;
    setBusy(true);
    setActionError(null);
    void marketClient
      .setEnabled({ id: hostPlugin.id, enabled })
      .catch((failure: unknown) => setActionError(errorText(failure)))
      .finally(() => setBusy(false));
  };

  const runUninstall = () => {
    if (!hostPlugin) return;
    setBusy(true);
    setActionError(null);
    void marketClient
      .uninstall({ id: hostPlugin.id, removeData })
      .then(() => onClose())
      .catch((failure: unknown) => setActionError(errorText(failure)))
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

  return createPortal(
    <div className="plugins-v3__modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div
        ref={dialogRef}
        className={`plugins-v3__modal plugins-v3__plugin--${tone}`}
        role="dialog"
        aria-modal="true"
        aria-label={name}
        onKeyDown={onKeyDown}
      >
        <div className="plugins-v3__modal-head">
          <span className={`plugins-v3__icon plugins-v3__icon--lg plugins-v3__icon--${tone}`} aria-hidden="true">
            <Icon size={18} strokeWidth={2} />
            <span className="plugins-v3__dot" />
          </span>
          <div className="plugins-v3__title-col">
            <div className="plugins-v3__title-line">
              <strong className="plugins-v3__modal-title">{name}</strong>
              {kind ? <span className="plugins-v3__kind">{text.kinds[kind]}</span> : null}
              {hostPlugin?.source === "manual" && text.unreviewedBadge ? <span className="plugins-v3__kind">{text.unreviewedBadge}</span> : null}
              <span className="plugins-v3__state">{text.states[state]}</span>
            </div>
            <span className="plugins-v3__id">{id}</span>
          </div>
          {targetPage && onOpenPage ? (
            <SettingsLinkButton onClick={() => { onClose(); onOpenPage(targetPage); }}>
              {settingsText.shortcuts.openFeaturePage}
            </SettingsLinkButton>
          ) : null}
          {builtin ? (
            <div className="plugins-v3__switch">
              <SettingsSwitch id={switchId} checked={builtin.enabled} disabled={builtin.kind === "essential" || busy} onChange={toggleBuiltin} />
            </div>
          ) : managedThirdParty ? (
            <div className="plugins-v3__switch">
              <SettingsSwitch id={switchId} checked={thirdPartyEnabled} disabled={busy} onChange={toggleThirdParty} />
            </div>
          ) : null}
          <button
            ref={closeRef}
            className="plugins-v3__modal-close"
            type="button"
            disabled={busy}
            aria-label={text.closeDetail}
            title={text.closeDetail}
            onClick={onClose}
          >
            <X size={15} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        {note ? <p className="plugins-v3__note">{note}</p> : null}
        {detail ? <p className={`plugins-v3__detail plugins-v3__detail--${tone}`}>{detail}</p> : null}
        {actionError ? <p className="plugins-v3__error-banner">{actionError}</p> : null}
        {hostPlugin ? <PluginLastErrorDetails plugin={hostPlugin} defaultOpen /> : null}
        {hostPlugin?.usage ? <><PluginUsageList plugin={hostPlugin} /><SettingsFootnote text={text.cpuNote} /></> : null}

        {managedThirdParty ? (
          confirmingUninstall ? (
            <div className="plugins-v3__uninstall-box">
              <p className="plugins-v3__uninstall-prompt">{text.market.uninstallPrompt(id)}</p>
              <label className="plugins-v3__uninstall-check">
                <input
                  type="checkbox"
                  checked={removeData}
                  disabled={busy}
                  onChange={(e) => setRemoveData(e.currentTarget.checked)}
                />
                <span>{text.market.uninstallRemoveData}</span>
              </label>
              <div className="plugins-v3__modal-actions">
                <button
                  className="plugins-v3__btn"
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmingUninstall(false)}
                >
                  {text.market.cancelBtn}
                </button>
                <button
                  className="plugins-v3__btn plugins-v3__btn--danger"
                  type="button"
                  disabled={busy}
                  data-action="confirm-uninstall-plugin"
                  onClick={runUninstall}
                >
                  {busy ? text.market.uninstallingBtn : text.market.uninstallConfirmBtn}
                </button>
              </div>
            </div>
          ) : (
            <div className="plugins-v3__modal-actions">
              <button
                className="plugins-v3__btn plugins-v3__btn--danger"
                type="button"
                disabled={busy}
                data-action="uninstall-plugin"
                onClick={() => setConfirmingUninstall(true)}
              >
                <Trash2 size={13} strokeWidth={2.2} aria-hidden="true" />
                <span>{text.market.uninstallBtn}</span>
              </button>
            </div>
          )
        ) : null}
      </div>
    </div>,
    document.querySelector(".settings-stage") ?? document.getElementById("page") ?? document.body,
  );
}
