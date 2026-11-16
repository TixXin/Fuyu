import { useQQNotifications } from "../qq-notifications/QQNotifications";
import { useWeChatReminders } from "../wechat/WeChatReminders";
import { useMail } from "../mail/MailPanel";
import { usePluginNotifications } from "../../plugins/usePluginNotifications";
import { useState } from "react";
import { useLatestMessagePreview } from "./useLatestMessagePreview";

export function useIslandNotices({ mode, isTucked, quiet, revealOnMessage }: { mode: string; isTucked: boolean; quiet: boolean; revealOnMessage: boolean }) {
  const [messagePanelOpen, setMessagePanelOpen] = useState(false);
  const canPreviewMessages = !quiet && ((mode === "collapsed" && (!isTucked || revealOnMessage)) || messagePanelOpen);
  const qqNotifications = useQQNotifications(canPreviewMessages);
  const wechatReminders = useWeChatReminders(canPreviewMessages);
  const qqMail = useMail(canPreviewMessages);
  const pluginNotifications = usePluginNotifications(canPreviewMessages);
  const hasMessagePreview = Boolean(
    qqNotifications.preview || wechatReminders.previewReceivedAt !== null || qqMail.preview || pluginNotifications.notification,
  );
  const preview = useLatestMessagePreview(qqNotifications, wechatReminders, qqMail, pluginNotifications);
  return { qqNotifications, wechatReminders, qqMail, pluginNotifications, preview, setMessagePanelOpen, hasMessagePreview };
}

