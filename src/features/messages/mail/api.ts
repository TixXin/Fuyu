import { invoke } from "@tauri-apps/api/core";
import type { NativeError } from "../../../i18n/nativeError";
import { listen, type EventCallback } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";

export function openMailLink(url: string) {
  return openUrl(url);
}

export type MailMessage = {
  id: string;
  uid: number;
  sender: string;
  subject: string;
  receivedAt: number | null;
  unread: boolean;
};

export type MailAttachment = { part: string; name: string; size: number; mime: string };

export type MailContent = { id: string; content: string; contentType: "text/plain" | "text/html"; attachments: MailAttachment[] };

export type OutgoingMail = { to: string[]; cc: string[]; subject: string; body: string };
export type MailReplyDraft = { to: string; subject: string };

export function getMailReply(email: string, messageId: string) {
  return invoke<MailReplyDraft>("get_qq_mail_reply", { email, messageId });
}

export function sendMail(email: string, mail: OutgoingMail, replyTo?: string) {
  return invoke<void>("send_qq_mail", { email, mail, replyTo: replyTo ?? null });
}

export function saveMailAttachment(email: string, messageId: string, part: string) {
  return invoke<string>("save_qq_mail_attachment", { email, messageId, part });
}

export type MailSnapshot = {
  revision: number;
  email: string | null;
  configured: boolean;
  enabled: boolean;
  syncing: boolean;
  status: "disconnected" | "connecting" | "connected" | "paused" | "authRequired" | "error";
  unreadCount: number | null;
  items: MailMessage[];
  lastSyncedAt: number | null;
  error: NativeError | string | null;
};

export type MailEvent = { snapshot: MailSnapshot; newestId: string | null; windowVisible: boolean };

export const MAIL_CHANGED_EVENT = "qq-mail-changed";

export type MailCommand = "connect_qq_mail" | "set_qq_mail_enabled" | "refresh_qq_mail" | "disconnect_qq_mail" | "mark_qq_mail_read" | "mark_all_qq_mail_read";

export function getMailState() {
  return invoke<MailSnapshot[]>("get_qq_mail_state");
}

export function invokeMailCommand(command: MailCommand, args?: Record<string, unknown>) {
  return invoke<MailSnapshot>(command, args);
}

export function readMailContent(email: string, messageId: string) {
  return invoke<MailContent>("read_qq_mail", { email, messageId });
}

export function listenMailChanged(handler: EventCallback<MailEvent>) {
  return listen<MailEvent>(MAIL_CHANGED_EVENT, handler);
}
