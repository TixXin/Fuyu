import zhCN from "../../i18n/locales/zh-CN.ts";
import type { Translations } from "../../i18n/types";

export type MessageSource = "qq" | "wechat" | "qqMail";
export type PreviewSource = MessageSource | "plugin";

export type MessagePreview = {
  source: PreviewSource;
  title: string;
  body: string;
  receivedAt: number;
  account?: string | null;
  iconUrl?: string | null;
  inline?: boolean;
  mediaControls?: boolean;
  chat?: string | null;
};

export function messagePreviewText(preview: MessagePreview, copy: Translations["messages"] = zhCN.messages): string {
  if (preview.source === "wechat" && preview.chat) return copy.qqPreview(preview.title, preview.body);
  if (preview.source === "wechat") return copy.wechatPreview;
  if (preview.source === "qqMail") return preview.body.trim() || copy.newMail;
  if (preview.source === "plugin") return preview.body.trim() ? copy.qqPreview(preview.title, preview.body.trim()) : preview.title;
  return copy.qqPreview(preview.title.trim() || "QQ", preview.body.trim() || copy.newMessage);
}

export function latestMessagePreview(candidates: (MessagePreview | null)[], latestReceivedAt = -Infinity): MessagePreview | null {
  return candidates.reduce<MessagePreview | null>(
    (latest, candidate) => candidate && candidate.receivedAt >= latestReceivedAt
      && (!latest || candidate.receivedAt > latest.receivedAt) ? candidate : latest,
    null,
  );
}

export function mailBadgeCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}
