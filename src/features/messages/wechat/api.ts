import { invoke } from "@tauri-apps/api/core";
import { listen, type EventCallback } from "@tauri-apps/api/event";

// 与 src-tauri/src/wechat_reminders/mod.rs 中返回给前端的结构对应。
export type ReminderSnapshot = {
  revision: number;
  enabled: boolean;
  status: "disabled" | "waiting" | "listening" | "error";
  pending: boolean;
  lastAttentionAt: number | null;
  error: string | null;
  /** The newest message read from WeChat's chat list; null while WeChat keeps its UI hidden. */
  message: ChatMessage | null;
  /** The reminders since the island started (or the list was cleared), newest first. */
  items: ReminderItem[];
  /** Setting: switch WeChat's accessibility on so its chat list can be read. */
  exposeUi: boolean;
  /** How that is going; null while off. */
  exposeStatus: string | null;
  /** Setting: a minimized WeChat leaves the taskbar, so minimizing can stand in for the tray. */
  hideTaskbarButton: boolean;
};

/** One chat with a new message (contact and the last message as WeChat's chat list shows them). */
export type ChatMessage = {
  /** What `launchWeChat` takes to open this chat. */
  chat: string;
  contact: string;
  preview: string;
  unread: number | null;
  /** When it was read (ms); unique per message. */
  at: number;
};

/** Why a reminder came without a contact and message (wechat_reminders/reader.rs). */
export type PlainReason = "tray" | "unreadable" | "baseline" | "unchanged" | "muted";

/** One row of the panel's list: a chat message, or a reminder that came without one. */
export type ReminderItem = {
  /** When it came (ms); unique, so also the row's key. */
  at: number;
  message: ChatMessage | null;
  /** Null too when the chat list is not read at all ("show the contact and message" off). */
  reason: PlainReason | null;
};

export type ReminderEvent = { snapshot: ReminderSnapshot; windowVisible: boolean };

// 与 wechat_reminders/mod.rs 中推送的事件名一致。
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

/** Empties the panel's list. */
export function clearWeChatReminders() {
  return invoke<ReminderSnapshot>("clear_wechat_reminders");
}

/** Brings WeChat up; with `chat` it also opens that chat when WeChat's list shows it. */
export function launchWeChat(chat?: string | null) {
  return invoke("open_wechat", { chat: chat ?? null });
}

export function listenWeChatReminderChanged(handler: EventCallback<ReminderEvent>) {
  return listen<ReminderEvent>(WECHAT_REMINDER_CHANGED_EVENT, handler);
}
