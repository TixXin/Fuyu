import { useLayoutEffect, useMemo } from "react";
import { runnerSlot } from "../../../windows/settings/slots/runnerSlot";
import { useQQNotifications } from "../qq-notifications/QQNotifications";
import { useWeChatReminders } from "../wechat/WeChatReminders";
import { announceMessageControllers, holdMessageControllers } from "../settingsControllers";

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
