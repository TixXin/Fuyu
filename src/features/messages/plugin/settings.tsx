import { useLayoutEffect, useMemo } from "react";
import { runnerSlot } from "../../../windows/settings/slots/runnerSlot";
import { useQQNotifications } from "../qq-notifications/QQNotifications";
import { useWeChatReminders } from "../wechat/WeChatReminders";
import { announceMessageControllers, holdMessageControllers } from "../settingsControllers";
import { addSettingsCategory } from "../../../windows/settings/slots/categorySlot";
import { MessagesSettingsPage } from "../MessagesSettingsPage";

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

runnerSlot.add({ id: "messages.controllers", component: MessagesRunner });

addSettingsCategory("messages", ({ settings, unsupported, onSettingsChange }) => <MessagesSettingsPage settings={settings} unsupported={unsupported} onSettingsChange={onSettingsChange} />);
