import { useState } from "react";
import { Mail, MessageCircle, MessageSquare, Plus } from "lucide-react";
import { SettingsChoiceCards } from "../../components/settings/SettingsChoiceCards";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsIconTitle } from "../../components/settings/SettingsIconTitle";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { MESSAGE_PANEL_SECONDS } from "../../features/appearance/settings";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import type { IslandSettings, MessageNotice } from "../../features/appearance/types";
import { isMacOS, type PlatformFeature } from "../../lib/platform";
import { MailAccountList } from "../../features/messages/mail/MailAccountList";
import { MailConnectForm } from "../../features/messages/mail/MailConnectForm";
import { MAX_MAIL_ACCOUNTS } from "../../features/messages/mail/mailAccounts";
import { loadMailAccounts } from "../../features/messages/mail/storage";
import { useMailAccounts } from "../../features/messages/mail/useMailAccounts";
import type { QQNotificationsController } from "../../features/messages/qq-notifications/QQNotifications";
import type { WeChatRemindersController } from "../../features/messages/wechat/WeChatReminders";
import { IslandGlyph } from "../../features/appearance/IslandGlyph";
import { useTranslation } from "../../i18n";
import { FeatureHeader } from "./FeatureHeader";
import "./MessagesSettingsPage.css";

export function MessagesSettingsPage({
  settings,
  qqNotifications,
  wechatReminders,
  unsupported,
  onSettingsChange,
}: {
  settings: IslandSettings;
  qqNotifications: QQNotificationsController;
  wechatReminders: WeChatRemindersController;
  unsupported: ReadonlySet<PlatformFeature>;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const t = useTranslation();
  const labels = t.settings.messageSources;
  const sourcesOn = [!unsupported.has("qq") && qqNotifications.snapshot.enabled, !unsupported.has("wechat") && wechatReminders.snapshot.enabled, settings.mailEnabled].filter(Boolean).length;

  return (
    <>
      <FeatureHeader feature="messages" aside={labels.sourcesOn(sourcesOn)} />
      <SettingsGroup title={labels.noticeTitle} footer={<SettingsFootnote text={labels.noticeHint} />}>
        <SettingsRow title={labels.noticeLabel}>
          <SettingsChoiceCards<MessageNotice>
            value={settings.messageNotice}
            ariaLabel={labels.noticeLabel}
            options={[
              { value: "line", label: labels.noticeLine, hint: labels.noticeLineHint, art: <IslandGlyph state="collapsed" /> },
              { value: "banner", label: labels.noticeBanner, hint: labels.noticeBannerHint, art: <IslandGlyph state="banner" /> },
              { value: "panel", label: labels.noticePanel, hint: labels.noticePanelHint, art: <IslandGlyph state="expanded" /> },
            ]}
            onChange={(messageNotice) => onSettingsChange({ ...settings, messageNotice })}
          />
        </SettingsRow>
        {settings.messageNotice === "panel" && (
          <SettingsRow
            title={labels.panelSeconds}
            indent
            control={
              <SettingsSelect
                value={String(settings.messagePanelSeconds)}
                options={MESSAGE_PANEL_SECONDS.map((seconds) => ({ value: String(seconds), label: labels.panelSecondsValue(seconds) }))}
                ariaLabel={labels.panelSeconds}
                onChange={(value) => onSettingsChange({ ...settings, messagePanelSeconds: Number(value) })}
              />
            }
          />
        )}
      </SettingsGroup>
      {!unsupported.has("qq") && <QQGroup controller={qqNotifications} title={labels.qqTitle} hint={isMacOS ? labels.qqHintMac : labels.qqHint} />}
      {!unsupported.has("wechat") && <SettingsGroup title={labels.wechatTitle} footer={<Problem error={wechatReminders.actionError || wechatReminders.snapshot.error || (wechatReminders.snapshot.status === "permissionRequired" ? t.wechat.status.permissionRequired : null)} hint={isMacOS ? labels.wechatHintMac : labels.wechatHint} />}>
        <SettingsToggleRow
          title={<SettingsIconTitle icon={<MessageSquare size={15} strokeWidth={1.9} />} tone="var(--mint-text, #98d4bb)">{t.wechat.receive}</SettingsIconTitle>}
          description={wechatReminders.snapshot.enabled ? t.wechat.status[wechatReminders.snapshot.status] : undefined}
          checked={wechatReminders.snapshot.enabled}
          onChange={(enabled) => void wechatReminders.setEnabled(enabled)}
        />
        {wechatReminders.snapshot.enabled && !isMacOS && (
          <SettingsToggleRow
            title={t.wechat.exposeUi}
            description={<>{t.wechat.exposeUiDescription}{wechatReminders.snapshot.exposeStatus && <><br />{wechatReminders.snapshot.exposeStatus}</>}</>}
            checked={wechatReminders.snapshot.exposeUi}
            indent
            onChange={(enabled) => void wechatReminders.setExposeUi(enabled)}
          />
        )}
        {wechatReminders.snapshot.enabled && wechatReminders.snapshot.exposeUi && !isMacOS && (
          <SettingsToggleRow
            title={t.wechat.hideTaskbarButton}
            description={t.wechat.hideTaskbarButtonDescription}
            checked={wechatReminders.snapshot.hideTaskbarButton}
            indent
            onChange={(enabled) => void wechatReminders.setHideTaskbarButton(enabled)}
          />
        )}
      </SettingsGroup>}
      <MailGroups settings={settings} onSettingsChange={onSettingsChange} />
    </>
  );
}

function Problem({ error, hint }: { error: string | null | undefined; hint: string }) {
  return error ? <span className="messages-settings__error" role="alert">{error}</span> : <SettingsFootnote text={hint} />;
}

function QQGroup({ controller, title, hint }: { controller: QQNotificationsController; title: string; hint: string }) {
  const t = useTranslation();
  const { snapshot, busy, actionError, setEnabled, requestAccess, openSettings } = controller;
  const needsAccess = snapshot.enabled && (snapshot.status === "permissionRequired" || snapshot.status === "permissionDenied");
  const error = actionError || snapshot.error || (needsAccess ? (isMacOS ? t.qq.permissionRequiredMac : t.qq.status[snapshot.status]) : null);

  return (
    <SettingsGroup title={title} footer={<Problem error={error} hint={hint} />}>
      <SettingsToggleRow
        title={<SettingsIconTitle icon={<MessageCircle size={15} strokeWidth={1.9} />} tone="var(--info-text, #9fd0ff)">{t.qq.receive}</SettingsIconTitle>}
        description={snapshot.enabled ? t.qq.status[snapshot.status] : undefined}
        checked={snapshot.enabled}
        onChange={(enabled) => void setEnabled(enabled)} />
      {needsAccess && (
        <SettingsRow
          title={t.qq.allowLabel}
          indent
          control={
            snapshot.status === "permissionRequired" ? (
              <SettingsLinkButton disabled={busy} onClick={() => void requestAccess()}>{t.qq.grant}</SettingsLinkButton>
            ) : (
              <SettingsLinkButton disabled={busy} onClick={() => void openSettings()}>{isMacOS ? t.qq.settingsMac : t.qq.settings}</SettingsLinkButton>
            )
          }
        />
      )}
    </SettingsGroup>
  );
}

function MailGroups({ settings, onSettingsChange }: { settings: IslandSettings; onSettingsChange: (settings: IslandSettings) => void }) {
  const t = useTranslation();
  const { mailboxes, busy, actionError, connect, setEnabled, disconnect, openHelp } = useMailAccounts({ restore: false });
  const [reauthorizing, setReauthorizing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const labels = t.settings.messageSources;
  const hosts = Object.fromEntries(loadMailAccounts().map((account) => [account.email, account.host]));
  const full = mailboxes.length >= MAX_MAIL_ACCOUNTS;
  const target = (reauthorizing ? mailboxes.find((mailbox) => mailbox.email === reauthorizing) : undefined)?.email ?? null;

  return (
    <>
      <SettingsGroup title={t.settings.categories.mail} footer={settings.mailEnabled ? <Problem error={actionError} hint={isMacOS ? t.mail.accountsHintMac : t.mail.accountsHint} /> : undefined}>
        <SettingsToggleRow
          title={<SettingsIconTitle icon={<Mail size={15} strokeWidth={1.9} />} tone="var(--warning-text, #f2d27a)">{t.settings.modules.mail}</SettingsIconTitle>}
          description={settings.mailEnabled ? labels.mailCount(mailboxes.length) : t.settings.modules.hint}
          checked={settings.mailEnabled}
          onChange={(mailEnabled) => onSettingsChange({ ...settings, mailEnabled })}
        />
        {settings.mailEnabled && mailboxes.length > 0 && (
          <div className="messages-settings__mailboxes">
            <MailAccountList
              mailboxes={mailboxes}
              hosts={hosts}
              busy={busy}
              onSetEnabled={(email, enabled) => void setEnabled(email, enabled)}
              onReauthorize={setReauthorizing}
              onDisconnect={(email) => {
                if (email === target) setReauthorizing(null);
                void disconnect(email);
              }}
            />
          </div>
        )}
        {settings.mailEnabled && (target || adding) && !(full && !target) && (
          <SettingsRow searchable={false} title={target ? t.mail.reauthorizeTitle(target) : t.mail.addTitle}>
            <MailConnectForm
              reauthorizing={target}
              busy={busy}
              onConnect={async (email, code, host) => {
                const connected = await connect(email, code, host);
                if (connected) { setReauthorizing(null); setAdding(false); }
                return connected;
              }}
              onHelp={() => void openHelp()}
              onCancel={() => { setReauthorizing(null); setAdding(false); }}
            />
          </SettingsRow>
        )}
        {settings.mailEnabled && !target && !adding && (
          <SettingsRow
            searchable={false}
            title={full ? <span className="messages-settings__muted">{t.mail.limitReached(MAX_MAIL_ACCOUNTS)}</span> : ""}
            control={full ? null : <SettingsLinkButton onClick={() => setAdding(true)}><Plus size={13} strokeWidth={2.2} aria-hidden="true" />{t.mail.addTitle}</SettingsLinkButton>}
          />
        )}
      </SettingsGroup>
    </>
  );
}
