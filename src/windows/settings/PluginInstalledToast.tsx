import { useEffect } from "react";
import { CircleCheck, X } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { PluginSetupNeed } from "./pluginSetupStore";

export interface InstalledNotice {
  id: string;
  name: string;
  version: string;
  updated: boolean;
}

export const INSTALLED_TOAST_MS = 8000;

export function PluginInstalledToast({ notice, setup, onOpenSettings, onDismiss }: {
  notice: InstalledNotice;
  setup: PluginSetupNeed | null;
  onOpenSettings: () => void;
  onDismiss: () => void;
}) {
  const text = useTranslation().settings.pluginsV3.page;
  const waiting = setup !== null;
  useEffect(() => {
    if (waiting) return;
    const timer = window.setTimeout(onDismiss, INSTALLED_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [waiting, onDismiss]);
  return (
    <div className="plugin-toast" role="status" data-installed-toast={notice.id} data-setup={waiting ? "needed" : undefined}>
      <CircleCheck className="plugin-toast__icon" size={16} strokeWidth={2.2} aria-hidden="true" />
      <div className="plugin-toast__text">
        <b>{notice.updated ? text.installed.updated(notice.name, notice.version) : text.installed.done(notice.name)}</b>
        {setup ? <span>{text.installed.setup(setup.hint)}</span> : null}
      </div>
      {setup ? <button className="plugin-btn plugin-btn--sm plugin-btn--primary" type="button" data-action="toast-setup" onClick={onOpenSettings}>{text.setup.go}</button> : null}
      <button className="plugin-icon-btn" type="button" aria-label={text.installed.dismiss} title={text.installed.dismiss} data-action="toast-dismiss" onClick={onDismiss}>
        <X size={14} strokeWidth={2.2} aria-hidden="true" />
      </button>
    </div>
  );
}
