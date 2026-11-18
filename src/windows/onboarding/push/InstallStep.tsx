import { Check, Download, Monitor, Server } from "lucide-react";
import { useState } from "react";
import { useErrorText, useTranslation } from "../../../i18n";
import type { TargetEntry } from "./plan";
import { PushTunnels } from "./PushTunnels";
import type { PushTargets } from "./usePushTargets";

export function InstallStep({ targets }: { targets: PushTargets }) {
  const text = useTranslation().onboarding.push;
  const errorText = useErrorText();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<Record<string, string>>({});

  const install = async ({ target }: TargetEntry) => {
    setBusy(target.id);
    setFailed((previous) => ({ ...previous, [target.id]: "" }));
    try {
      await target.install();
      await targets.refresh();
    } catch (reason) {
      setFailed((previous) => ({ ...previous, [target.id]: errorText(reason) }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <p className="push-act__lead">{text.install.lead}</p>
      <ul className="push-act__list">
        {targets.entries.map((entry) => {
          const { target, state } = entry;
          const Icon = target.remote ? Server : Monitor;
          const error = failed[target.id] || targets.errors[target.id];
          return (
            <li key={target.id} className="push-act__row" data-target={target.id}>
              <Icon size={15} aria-hidden="true" className="push-act__icon" />
              <div className="push-act__main">
                <span className="push-act__name">{target.label ?? text.thisComputer}</span>
                <span className="push-act__note">
                  {state === null ? (error ? null : text.install.reading) : state.installed ? (state.running ? `${text.install.installed} · ${text.install.running}` : text.install.installed) : text.install.missing}
                </span>
                {error ? <span className="push-act__error">{error}</span> : null}
              </div>
              {state?.installed ? (
                <Check size={15} aria-hidden="true" className="push-act__ok" />
              ) : state ? (
                <button className="onboarding__button" type="button" disabled={busy !== null} onClick={() => void install(entry)}>
                  <Download size={13} aria-hidden="true" />
                  {busy === target.id ? text.install.installing : text.install.install}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <PushTunnels hosts={targets.entries.flatMap(({ target }) => (target.remote && target.label ? [target.label] : []))} />
    </>
  );
}
