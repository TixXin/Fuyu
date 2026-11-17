import { useSyncExternalStore } from "react";
import { useLocale, useTranslation } from "../../i18n";
import { MailPanel, type MailController } from "./mail/MailPanel";
import { QQNotificationPanel, type QQNotificationsController } from "./qq-notifications/QQNotifications";
import { WeChatReminderPanel, type WeChatRemindersController } from "./wechat/WeChatReminders";
import { MessageSourceIcon } from "./MessageSourceIcon";
import { getMessageSourcesSnapshot, subscribeMessageSources } from "./host/sources.mjs";
import { sharedMailProvider } from "./mail/mailProvider";
import { mailBadgeCount, type MessageSource } from "./messagePreview";

export type MessageView = MessageSource;

type MessagesProps = {
  qqMail: MailController;
  qqNotifications: QQNotificationsController;
  wechatReminders: WeChatRemindersController;
  source: MessageView;
  enabledSources: Record<MessageSource, boolean>;
  onSourceChange: (source: MessageView) => void;
  onOpenMailSettings?: () => void;
};

export function messagePanelHeight(source: MessageView, readingMail = false) {
  return source === "qqMail" && readingMail ? 450 : 350;
}

export function MessagesPanel({ qqMail, qqNotifications, wechatReminders, source, enabledSources, onSourceChange, onOpenMailSettings }: MessagesProps) {
  const t = useTranslation();
  const locale = useLocale().locale === "en" ? "en" : "zh";
  const { snapshot: qq } = qqNotifications;
  const extraSources = useSyncExternalStore(subscribeMessageSources, getMessageSourcesSnapshot).filter((item) => !item.builtin && item.enabled);
  const navigate = (next: MessageView) => onSourceChange(next);
  const navigation = (
    <div className="message-sources" role="group" aria-label={t.messages.sources}>
      {enabledSources.qq && <button type="button" aria-label={t.messages.qqNotifications} aria-pressed={source === "qq"} onClick={() => navigate("qq")}><MessageSourceIcon source="qq" /><span>QQ</span>{qq.items.length > 0 && <span className="message-source-count">{mailBadgeCount(qq.items.length)}</span>}</button>}
      {enabledSources.wechat && <button type="button" aria-label={t.messages.wechatReminders} aria-pressed={source === "wechat"} onClick={() => navigate("wechat")}><MessageSourceIcon source="wechat" /><span>{t.messages.wechat}</span>{wechatReminders.snapshot.pending && <span className="message-source-dot" aria-label={t.messages.newReminder} />}</button>}
      {enabledSources.qqMail && <button type="button" aria-label={t.messages.qqMail} aria-pressed={source === "qqMail"} onClick={() => navigate("qqMail")}><MessageSourceIcon source="qqMail" mailProvider={sharedMailProvider(qqMail.mailboxes.map((mailbox) => mailbox.email))} /><span>{t.messages.mail}</span>{qqMail.unreadTotal > 0 && <span className="message-source-count">{mailBadgeCount(qqMail.unreadTotal)}</span>}</button>}
      {extraSources.map((entry) => {
        const label = typeof entry.label === "string" ? entry.label : entry.label[locale] ?? entry.label.zh;
        return (
          <button key={entry.id} type="button" aria-label={label} aria-pressed={false}>
            <MessageSourceIcon source="plugin" />
            <span>{label}</span>
            {entry.unreadCount > 0 ? <span className="message-source-count">{mailBadgeCount(entry.unreadCount)}</span> : entry.pending ? <span className="message-source-dot" aria-label={t.messages.newReminder} /> : null}
          </button>
        );
      })}
    </div>
  );

  if (source === "qqMail") return <MailPanel controller={qqMail} navigation={navigation} onOpenSettings={onOpenMailSettings} />;
  if (source === "wechat") return <WeChatReminderPanel controller={wechatReminders} navigation={navigation} />;
  return <QQNotificationPanel controller={qqNotifications} navigation={navigation} />;
}
