import { useId, type ReactNode } from "react";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSwitch } from "../../../components/settings/SettingsSwitch";
import type { SourceTone } from "./sourceRows.ts";

export function MessageSourceRow({ kind, icon, name, enabled, tone, status, capability, extra, badge, action, disabled, onToggle }: {
  kind: string;
  icon: ReactNode;
  name: string;
  enabled: boolean;
  tone: SourceTone;
  status?: string;
  capability?: string;
  extra?: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
  disabled?: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const id = useId();
  return (
    <SettingsRow
      className={`source-row source-row--${kind}${enabled ? "" : " source-row--off"}`}
      labelFor={id}
      title={<><span className="source-row__icon" aria-hidden="true">{icon}</span>{name}</>}
      description={
        <span className="source-row__meta" data-search="off">
          {enabled && status ? (
            <span className="source-row__status" data-tone={tone}>
              <span className="source-row__dot" aria-hidden="true" />
              {status}
            </span>
          ) : null}
          {capability ? <span className="source-row__capability">{capability}</span> : null}
          {extra}
        </span>
      }
      control={<>{badge}{action}<SettingsSwitch id={id} checked={enabled} disabled={disabled} onChange={onToggle} /></>}
    />
  );
}
