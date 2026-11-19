import type { IslandSettings } from "../../lib/settings/types";
import type { PlatformFeature } from "../../lib/platform";
import type { ImSourcesController } from "./im-sources/useImSources";
import type { QQNotificationsController } from "./qq-notifications/QQNotifications";
import { useMessageControllers } from "./settingsControllers";
import type { WeChatRemindersController } from "./wechat/WeChatReminders";
import "./MessagesSettingsPage.css";
import { SlotView } from "../plugin-kernel/SlotView";
import { settingsSections } from "../plugin-kernel/settingsSlots";
import { OWNER } from "./plugin/owner.ts";
import { NoticeSection } from "./settings/NoticeSection";
import { SourcesSection } from "./settings/SourcesSection";

type MessagesSectionProps = {
  settings: IslandSettings;
  qqNotifications: QQNotificationsController;
  wechatReminders: WeChatRemindersController;
  imSources: ImSourcesController;
  unsupported: ReadonlySet<PlatformFeature>;
  onSettingsChange: (settings: IslandSettings) => void;
};

export type MessagesTab = "messages" | "messagesIm";

const sections = settingsSections<MessagesSectionProps, MessagesTab>();

sections.add({ id: "messagesIm.sources", category: "messagesIm", order: 10, component: SourcesSection }, OWNER);
sections.add({ id: "messages.notice", category: "messages", order: 10, component: NoticeSection }, OWNER);

export function MessagesSettingsPage({ tab, ...page }: Omit<MessagesSectionProps, "qqNotifications" | "wechatReminders" | "imSources"> & { tab: MessagesTab }) {
  const controllers = useMessageControllers();
  if (!controllers) return null;
  return <SlotView slot={sections} group={tab} props={{ ...page, ...controllers }} />;
}
