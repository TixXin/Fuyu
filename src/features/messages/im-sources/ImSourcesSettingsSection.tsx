import { useId } from "react";
import { SettingsFootnote } from "../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSwitch } from "../../../components/settings/SettingsSwitch";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../../i18n";
import { isMacOS } from "../../../lib/platform";
import { MessageSourceIcon } from "../MessageSourceIcon";
import {
  IM_SOURCE_IDS,
  sortImSourcesForSettings,
  WINDOWS_CUSTOM_POPUP_SOURCES,
  type ImSourceId,
} from "./imSourcesState";
import type { ImSourcesController } from "./useImSources";

function ImSourceRow({
  source,
  imSources,
}: {
  source: ImSourceId;
  imSources: ImSourcesController;
}) {
  const switchId = useId();
  const t = useTranslation();
  const labels = t.settings.messageSources;
  const snapshot = imSources.snapshots[source];
  const name = t.messages.sourceLabels[source];
  const busy = imSources.busySource === "all" || imSources.busySource === source;
  const needsAccess = snapshot.enabled && (snapshot.status === "permissionRequired" || snapshot.status === "permissionDenied");
  const showToastHint = snapshot.enabled && !isMacOS && WINDOWS_CUSTOM_POPUP_SOURCES.has(source);

  return (
    <>
      <SettingsRow
        labelFor={switchId}
        title={
          <span className="settings-icon-title">
            <span className="settings-icon-title__icon" aria-hidden="true">
              <MessageSourceIcon source={source} size={15} />
            </span>
            {t.messages.im.receive(name)}
          </span>
        }
        description={
          snapshot.enabled ? (
            <span data-search="off">
              {t.qq.status[snapshot.status]}
              {showToastHint ? ` · ${labels.imSystemToastHint}` : ""}
            </span>
          ) : undefined
        }
        control={
          <>
            {snapshot.installed && <span className="messages-settings__installed">{labels.installedBadge}</span>}
            <SettingsSwitch
              id={switchId}
              checked={snapshot.enabled}
              disabled={busy}
              onChange={(enabled) => void imSources.setEnabled(source, enabled)}
            />
          </>
        }
      />
      {snapshot.enabled && (
        <SettingsToggleRow
          title={t.qq.autoClear}
          description={isMacOS ? t.messages.im.autoClearDescriptionMac(name) : t.messages.im.autoClearDescription(name)}
          checked={imSources.autoClearMap[source]}
          indent
          onChange={(enabled) => imSources.setAutoClear(source, enabled)}
        />
      )}
      {needsAccess && (
        <SettingsRow
          searchable={false}
          title={t.messages.im.allowLabel(name)}
          indent
          control={
            snapshot.status === "permissionRequired" ? (
              <SettingsLinkButton disabled={busy} onClick={() => void imSources.requestAccess(source)}>
                {t.qq.grant}
              </SettingsLinkButton>
            ) : (
              <SettingsLinkButton disabled={busy} onClick={() => void imSources.openSettings(source)}>
                {isMacOS ? t.qq.settingsMac : t.qq.settings}
              </SettingsLinkButton>
            )
          }
        />
      )}
    </>
  );
}

export function ImSourcesSettingsSection({ imSources }: { imSources: ImSourcesController }) {
  const t = useTranslation();
  const labels = t.settings.messageSources;
  const ordered = sortImSourcesForSettings(imSources.snapshots, { isMacOS });

  let firstError: string | null = null;
  for (const id of IM_SOURCE_IDS) {
    const s = imSources.snapshots[id];
    const needsAccess = s.enabled && (s.status === "permissionRequired" || s.status === "permissionDenied");
    const err = imSources.actionErrors[id] || s.error || (needsAccess ? (isMacOS ? t.qq.permissionRequiredMac : t.qq.status[s.status]) : null);
    if (err) { firstError = err; break; }
  }

  return (
    <SettingsGroup
      title={labels.imOthersTitle}
      footer={
        firstError
          ? <span className="messages-settings__error" role="alert">{firstError}</span>
          : <SettingsFootnote text={isMacOS ? labels.imOthersHintMac : labels.imOthersHint} />
      }
    >
      {ordered.map((source) => (
        <ImSourceRow key={source} source={source} imSources={imSources} />
      ))}
    </SettingsGroup>
  );
}
