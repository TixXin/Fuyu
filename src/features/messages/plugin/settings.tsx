import { useLayoutEffect, useMemo } from "react";
import { settingsRunners } from "../../plugin-kernel/settingsSlots";
import { useQQNotifications } from "../qq-notifications/QQNotifications";
import { useWeChatReminders } from "../wechat/WeChatReminders";
import { announceMessageControllers, holdMessageControllers } from "../settingsControllers";
import { addSettingsCategory } from "../../plugin-kernel/settingsCategories";
import { MessagesSettingsPage } from "../MessagesSettingsPage";
import type { IslandSettings } from "../../../lib/settings/types";
import type { PlatformFeature } from "../../../lib/platform";
import { OWNER } from "./owner.ts";

type PageProps = {
  settings: IslandSettings;
  unsupported: ReadonlySet<PlatformFeature>;
  onSettingsChange(settings: IslandSettings): void;
};

function MessagesRunner() {
  const qqNotifications = useQQNotifications(false);
  const wechatReminders = useWeChatReminders(false);
  const controllers = useMemo(() => ({ qqNotifications, wechatReminders }), [qqNotifications, wechatReminders]);
  holdMessageControllers(controllers);
  useLayoutEffect(() => {
    holdMessageControllers(controllers);
    announceMessageControllers();
    return () => {
      holdMessageControllers(null);
      announceMessageControllers();
    };
  }, [controllers]);
  return null;
}

settingsRunners.add({ id: "messages.controllers", component: MessagesRunner }, OWNER);

const messagesPage = (tab: "messages" | "messagesIm" | "messagesMail") =>
  function MessagesPage({ settings, unsupported, onSettingsChange }: PageProps) {
    return <MessagesSettingsPage tab={tab} settings={settings} unsupported={unsupported} onSettingsChange={onSettingsChange} />;
  };

addSettingsCategory("messages", messagesPage("messages"), OWNER);
addSettingsCategory("messagesIm", messagesPage("messagesIm"), OWNER);
addSettingsCategory("messagesMail", messagesPage("messagesMail"), OWNER);
