import type { ComponentProps } from "react";
import { createRunnerStore } from "../../plugin-kernel/runnerStore";
import type { PluginNotificationsController } from "../../plugins/usePluginNotifications";
import type { MessageBanner } from "../banner/MessageBanner";
import type { useIslandMessagePanel } from "../island/useIslandMessagePanel";
import type { MailController } from "../mail/MailPanel";
import type { MessageView } from "../Messages";
import type { MessagePreview, MessageSource } from "../messagePreview";
import type { QQNotificationsController } from "../qq-notifications/QQNotifications";
import type { WeChatRemindersController } from "../wechat/WeChatReminders";

export type MessagesIsland = {
  qq: QQNotificationsController;
  wechat: WeChatRemindersController;
  mail: MailController;
  plugin: PluginNotificationsController;
  preview: MessagePreview | null;
  source: MessageView;
  open: (source: MessageSource) => void;
  panel: ReturnType<typeof useIslandMessagePanel> | null;
  banner: ComponentProps<typeof MessageBanner> | null;
};

export const messagesIsland = createRunnerStore<MessagesIsland | null>(null);
