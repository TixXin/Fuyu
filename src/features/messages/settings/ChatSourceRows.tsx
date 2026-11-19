import { useState, type ReactNode } from "react";
import { SettingsLinkButton } from "../../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../../i18n";
import { isMacOS } from "../../../lib/platform";
import { MessageSourceIcon } from "../MessageSourceIcon";
import { WINDOWS_CUSTOM_POPUP_SOURCES, type ImSourceId } from "../im-sources/imSourcesState";
import type { ImSourcesController } from "../im-sources/useImSources";
import type { QQNotificationsController } from "../qq-notifications/QQNotifications";
import type { WeChatRemindersController } from "../wechat/WeChatReminders";
import { MessageSourceRow } from "./MessageSourceRow";
import { chatCapability, chatTone, needsAccess, type ChatSource, type ChatSourceState } from "./sourceRows.ts";

function ChatRow({ source, state, statusText, exposeUi = false, installed = false, busy, extra, onToggle, onGrant, onOpenSettings }: {
  source: ChatSource;
  state: ChatSourceState;
  statusText: string;
  exposeUi?: boolean;
  installed?: boolean;
  busy: boolean;
  extra?: ReactNode;
  onToggle: (enabled: boolean) => void;
  onGrant?: () => void;
  onOpenSettings?: () => void;
}) {
  const t = useTranslation();
  const labels = t.settings.messageSources;
  const tone = chatTone(state, isMacOS);
  const access = needsAccess(state);
  const asks = state.status === "permissionRequired";
  const act = asks ? onGrant : onOpenSettings;

  return (
    <MessageSourceRow
      kind={source}
      icon={<MessageSourceIcon source={source} size={20} />}
      name={t.messages.sourceLabels[source]}
      enabled={state.enabled}
      tone={tone}
      status={state.error || (access && isMacOS ? labels.waitingForAccessMac : statusText)}
      capability={tone === "ok" || tone === "off" ? labels.capability[chatCapability(source, { mac: isMacOS, wechatExposeUi: exposeUi })] : undefined}
      extra={tone === "ok" ? extra : undefined}
      badge={installed && !state.enabled ? <span className="messages-settings__installed">{labels.installedBadge}</span> : undefined}
      action={access && !isMacOS && act ? <SettingsLinkButton disabled={busy} onClick={act}>{asks ? t.qq.grant : t.qq.settings}</SettingsLinkButton> : undefined}
      disabled={busy}
      onToggle={onToggle}
    />
  );
}

export function QQSourceRows({ controller }: { controller: QQNotificationsController }) {
  const t = useTranslation();
  const { snapshot, busy, actionError, setEnabled, requestAccess, openSettings } = controller;

  return (
    <ChatRow
      source="qq"
      state={{ enabled: snapshot.enabled, status: snapshot.status, error: actionError || snapshot.error }}
      statusText={t.qq.status[snapshot.status]}
      busy={busy}
      onToggle={(enabled) => void setEnabled(enabled)}
      onGrant={() => void requestAccess()}
      onOpenSettings={() => void openSettings()}
    />
  );
}

export function WeChatSourceRows({ controller }: { controller: WeChatRemindersController }) {
  const t = useTranslation();
  const { snapshot, busy, actionError, setEnabled, setExposeUi, setHideTaskbarButton } = controller;
  const options = snapshot.enabled && !isMacOS;

  return (
    <>
      <ChatRow
        source="wechat"
        state={{ enabled: snapshot.enabled, status: snapshot.status, error: actionError || snapshot.error }}
        statusText={t.wechat.status[snapshot.status]}
        exposeUi={snapshot.exposeUi}
        busy={busy}
        onToggle={(enabled) => void setEnabled(enabled)}
      />
      {options && (
        <SettingsToggleRow
          title={t.wechat.exposeUi}
          description={<>{t.wechat.exposeUiDescription}{snapshot.exposeStatus && <><br />{snapshot.exposeStatus}</>}</>}
          checked={snapshot.exposeUi}
          indent
          onChange={(enabled) => void setExposeUi(enabled)}
        />
      )}
      {options && snapshot.exposeUi && (
        <SettingsToggleRow
          title={t.wechat.hideTaskbarButton}
          description={t.wechat.hideTaskbarButtonDescription}
          checked={snapshot.hideTaskbarButton}
          indent
          onChange={(enabled) => void setHideTaskbarButton(enabled)}
        />
      )}
    </>
  );
}

export function ImSourceRows({ source, imSources, onToggled }: { source: ImSourceId; imSources: ImSourcesController; onToggled?: () => void }) {
  const t = useTranslation();
  const labels = t.settings.messageSources;
  const [explained, setExplained] = useState(false);
  const snapshot = imSources.snapshots[source];
  const ownPopups = !isMacOS && WINDOWS_CUSTOM_POPUP_SOURCES.has(source);
  const listening = snapshot.enabled && snapshot.status === "listening";

  return (
    <>
      <ChatRow
        source={source}
        state={{ enabled: snapshot.enabled, status: snapshot.status, error: imSources.actionErrors[source] || snapshot.error }}
        statusText={t.qq.status[snapshot.status]}
        installed={snapshot.installed}
        busy={imSources.busySource === "all" || imSources.busySource === source}
        extra={ownPopups ? (
          <button className="source-row__more" type="button" aria-expanded={explained} onClick={() => setExplained(!explained)}>{labels.howToSeeContent}</button>
        ) : undefined}
        onToggle={(enabled) => {
          onToggled?.();
          void imSources.setEnabled(source, enabled);
        }}
        onGrant={() => void imSources.requestAccess(source)}
        onOpenSettings={() => void imSources.openSettings(source)}
      />
      {ownPopups && listening && explained && (
        <SettingsRow searchable={false} indent title={<span className="source-row__note">{labels.imSystemToastHint}</span>} />
      )}
    </>
  );
}
