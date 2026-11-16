import type { ComponentProps } from "react";
import type { MessageBanner } from "../../src/features/messages/banner/MessageBanner";
import type { useIslandMessagePanel } from "../../src/features/messages/island/useIslandMessagePanel";
import type { MailController } from "../../src/features/messages/mail/MailPanel";
import type { MessagePreview, MessageSource } from "../../src/features/messages/messagePreview";
import { useMessagesIsland } from "../../src/features/messages/plugin/islandMessages";
import type { QQNotificationsController } from "../../src/features/messages/qq-notifications/QQNotifications";
import type { WeChatRemindersController } from "../../src/features/messages/wechat/WeChatReminders";
import type { PluginNotificationsController } from "../../src/features/messages/island/usePluginNotifications";

export type FixtureMessages = {
  qq: QQNotificationsController;
  wechat: WeChatRemindersController;
  mail: MailController;
  plugin?: PluginNotificationsController;
  preview?: MessagePreview | null;
  open?: (source: MessageSource) => void;
  panel?: ReturnType<typeof useIslandMessagePanel> | null;
  banner?: ComponentProps<typeof MessageBanner> | null;
};

export const NO_PLUGIN_NOTIFICATIONS: PluginNotificationsController = { notification: null, dismiss: () => {}, runAction: () => {}, post: () => {} };
const ignoreOpen = () => {};
const FLAGS = { showsMessage: false, hold: false, arrivalsHeight: null, maxPanelHeight: 490 };
const NO_PAGES = { qq: false, wechat: false };

export function useFixtureMessages(messages: FixtureMessages | null) {
  const state = messages && {
    qq: messages.qq,
    wechat: messages.wechat,
    mail: messages.mail,
    plugin: messages.plugin ?? NO_PLUGIN_NOTIFICATIONS,
    preview: messages.preview ?? null,
    source: "qq" as const,
    open: messages.open ?? ignoreOpen,
    panel: messages.panel ?? null,
    banner: messages.banner ?? null,
  };
  useMessagesIsland(state, { ...FLAGS, pages: messages ? { qq: messages.qq.snapshot.enabled, wechat: messages.wechat.snapshot.enabled } : NO_PAGES });
}
