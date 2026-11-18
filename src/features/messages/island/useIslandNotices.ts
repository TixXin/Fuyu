import { useState } from "react";
import { useImSources } from "../im-sources/useImSources";
import { useMail } from "../mail/useMail";
import { useQQNotifications } from "../qq-notifications/QQNotifications";
import { useWeChatReminders } from "../wechat/WeChatReminders";
import { useLatestMessagePreview } from "./useLatestMessagePreview";
import { usePluginNotifications } from "./usePluginNotifications";

export function useIslandNotices({ mode, isTucked, quiet, revealOnMessage }: { mode: string; isTucked: boolean; quiet: boolean; revealOnMessage: boolean }) {
  const [messagePanelOpen, setMessagePanelOpen] = useState(false);
  const canPreviewMessages = !quiet && ((mode === "collapsed" && (!isTucked || revealOnMessage)) || messagePanelOpen);
  const qqNotifications = useQQNotifications(canPreviewMessages);
  const wechatReminders = useWeChatReminders(canPreviewMessages);
  const qqMail = useMail(canPreviewMessages);
  const pluginNotifications = usePluginNotifications(canPreviewMessages);
  const imSources = useImSources(canPreviewMessages);
  const hasMessagePreview = Boolean(
    qqNotifications.preview
      || wechatReminders.previewReceivedAt !== null
      || qqMail.preview
      || pluginNotifications.notification
      || imSources.previews.length > 0,
  );
  const preview = useLatestMessagePreview(qqNotifications, wechatReminders, qqMail, pluginNotifications, imSources);
  return { qqNotifications, wechatReminders, qqMail, pluginNotifications, imSources, preview, setMessagePanelOpen, hasMessagePreview };
}
