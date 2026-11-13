import { invoke } from "@tauri-apps/api/core";
import { listen, type EventCallback } from "@tauri-apps/api/event";

export type QQNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  unread?: number | null;
};

export type QQNotificationSnapshot = {
  revision: number;
  enabled: boolean;
  status: "disabled" | "waiting" | "listening" | "permissionDenied" | "permissionRequired" | "error";
  items: QQNotification[];
  error: string | null;
};

export type QQNotificationEvent = {
  snapshot: QQNotificationSnapshot;
  newestId: string | null;
  windowVisible: boolean;
};

export const QQ_NOTIFICATIONS_CHANGED_EVENT = "qq-notifications-changed";

export function getQQNotificationState() {
  return invoke<QQNotificationSnapshot>("get_qq_notification_state");
}

export function setQQNotificationsEnabled(enabled: boolean) {
  return invoke<QQNotificationSnapshot>("set_qq_notifications_enabled", { enabled });
}

export function requestQQNotificationAccess() {
  return invoke<string>("request_qq_notification_access");
}

export function openQQNotificationSettings(access: boolean) {
  return invoke("open_qq_notification_settings", { access });
}

export function clearQQNotifications() {
  return invoke<QQNotificationSnapshot>("clear_qq_notifications");
}

export function launchQQ() {
  return invoke("open_qq");
}

export function listenQQNotificationsChanged(handler: EventCallback<QQNotificationEvent>) {
  return listen<QQNotificationEvent>(QQ_NOTIFICATIONS_CHANGED_EVENT, handler);
}
