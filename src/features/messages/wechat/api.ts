import { invoke } from "@tauri-apps/api/core";
import { listen, type EventCallback } from "@tauri-apps/api/event";

export type ReminderSnapshot = {
  revision: number;
  enabled: boolean;
  status: "disabled" | "waiting" | "listening" | "error" | "permissionRequired";
  pending: boolean;
  lastAttentionAt: number | null;
  error: string | null;
  message: ChatMessage | null;
  items: ReminderItem[];
  exposeUi: boolean;
  exposeStatus: string | null;
  hideTaskbarButton: boolean;
};

export type ChatMessage = {
  chat: string;
  contact: string;
  preview: string;
  unread: number | null;
  at: number;
};

export type PlainReason = "tray" | "unreadable" | "baseline" | "unchanged" | "muted" | "unread";

export type ReminderItem = {
  at: number;
  message: ChatMessage | null;
  reason: PlainReason | null;
  unread?: number | null;
};

export type ReminderEvent = { snapshot: ReminderSnapshot; windowVisible: boolean };

export const WECHAT_REMINDER_CHANGED_EVENT = "wechat-reminder-changed";

export function setWeChatRemindersEnabled(enabled: boolean) {
  return invoke<ReminderSnapshot>("set_wechat_reminders_enabled", { enabled });
}

export function setWeChatExposeUi(enabled: boolean) {
  return invoke<ReminderSnapshot>("set_wechat_expose_ui", { enabled });
}

export function setWeChatHideTaskbarButton(enabled: boolean) {
  return invoke<ReminderSnapshot>("set_wechat_hide_taskbar_button", { enabled });
}

export function clearWeChatReminders() {
  return invoke<ReminderSnapshot>("clear_wechat_reminders");
}

export function launchWeChat(chat?: string | null) {
  return invoke("open_wechat", { chat: chat ?? null });
}

export function listenWeChatReminderChanged(handler: EventCallback<ReminderEvent>) {
  return listen<ReminderEvent>(WECHAT_REMINDER_CHANGED_EVENT, handler);
}
