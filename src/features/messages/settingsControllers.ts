import { useSyncExternalStore } from "react";
import type { QQNotificationsController } from "./qq-notifications/QQNotifications";
import type { WeChatRemindersController } from "./wechat/WeChatReminders";

export interface MessageControllers {
  qqNotifications: QQNotificationsController;
  wechatReminders: WeChatRemindersController;
}

let current: MessageControllers | null = null;
const listeners = new Set<() => void>();

export function holdMessageControllers(controllers: MessageControllers | null) {
  current = controllers;
}

export function announceMessageControllers() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMessageControllers() {
  return useSyncExternalStore(subscribe, () => current);
}
