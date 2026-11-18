import { useState } from "react";
import { useTranslation } from "../../../i18n";
import type { ImSourcesController } from "../im-sources/useImSources";
import type { MailController } from "../mail/MailPanel";
import { latestMessagePreview } from "../messagePreview";
import type { QQNotificationsController } from "../qq-notifications/QQNotifications";
import type { WeChatRemindersController } from "../wechat/WeChatReminders";
import type { PluginNotificationsController } from "./usePluginNotifications";

export function useLatestMessagePreview(
  qqNotifications: QQNotificationsController,
  wechatReminders: WeChatRemindersController,
  qqMail: MailController,
  pluginNotifications: PluginNotificationsController,
  imSources?: Pick<ImSourcesController, "previews">,
) {
  const t = useTranslation();
  const qqPreview = qqNotifications.preview;
  const wechatPreviewAt = wechatReminders.previewReceivedAt;
  const wechatMessage = wechatReminders.previewMessage;
  const wechatUnread = wechatReminders.snapshot.items[0]?.unread ?? null;
  const pluginNotification = pluginNotifications.notification;
  const imPreviews = imSources?.previews ?? [];
  const [latestPreviewAt, setLatestPreviewAt] = useState(0);
  const preview = latestMessagePreview([
    qqPreview ? { ...qqPreview, body: qqPreview.unread ? t.messages.unreadCount(qqPreview.unread) : qqPreview.body, source: "qq", receivedAt: qqNotifications.previewReceivedAt ?? 0 } : null,
    wechatPreviewAt === null ? null
      : wechatMessage ? { source: "wechat", title: wechatMessage.contact, body: wechatMessage.preview, receivedAt: wechatPreviewAt, chat: wechatMessage.chat }
        : { source: "wechat", title: t.messages.wechat, body: wechatUnread ? t.messages.unreadCount(wechatUnread) : t.messages.newReminder, receivedAt: wechatPreviewAt },
    qqMail.preview ? { source: "qqMail", title: qqMail.preview.sender, body: qqMail.preview.subject, receivedAt: qqMail.previewReceivedAt ?? 0, account: qqMail.previewAccount } : null,
    pluginNotification ? {
      source: "plugin", title: pluginNotification.title, body: pluginNotification.body, receivedAt: pluginNotification.receivedAt,
      iconUrl: pluginNotification.iconUrl ?? null, inline: pluginNotification.layout === "inline", mediaControls: pluginNotification.controls === "media",
    } : null,
    ...imPreviews.map(({ source, item, receivedAt, replacedId }) => ({
      source,
      id: item.id,
      replacedId,
      kind: item.kind,
      title: item.kind === "badge" ? t.messages.sourceLabels[source] : item.title,
      body: item.kind === "badge" ? t.messages.unreadCount(item.unread ?? 1) : item.body,
      receivedAt,
    })),
  ], latestPreviewAt);
  if (preview && preview.receivedAt > latestPreviewAt) setLatestPreviewAt(preview.receivedAt);
  return preview;
}
