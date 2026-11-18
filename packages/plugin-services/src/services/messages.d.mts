import type { ServiceDefinition } from "../define.mjs";

export type MessageSourceId = "qq" | "wechat" | "qqMail" | (string & {});

export type MessageSourceStatus = {
  id: MessageSourceId;
  label: { zh: string; en: string } | string;
  builtin: boolean;
  enabled: boolean;
  unreadCount: number;
  pending: boolean;
  order: number;
  replacedBy?: string;
};

export type MessageArrivalNotice = {
  source: MessageSourceId;
  pluginId?: string;
  title: string;
  body: string;
  receivedAt?: number;
  durationMs?: number;
  iconUrl?: string | null;
  layout?: "default" | "inline";
  controls?: "none" | "media";
  actions?: string[];
};

export type MessagesMethods = {
  sources(): { sources: MessageSourceStatus[] };
  notify(notice: MessageArrivalNotice): { shown: boolean; receivedAt: number };
  clear(params?: { source?: MessageSourceId }): { ok: true };
};

export type MessagesEvents = {
  changed: {};
  arrived: MessageArrivalNotice & { receivedAt: number };
  action: { pluginId: string; source: MessageSourceId; action: string };
};

export const messagesV1: ServiceDefinition<MessagesMethods, MessagesEvents, {}>;
