import type { ImSourcesController } from "../im-sources/useImSources";
import type { MailController } from "../mail/MailPanel";
import type { MessageSource } from "../messagePreview";
import type { QQNotificationsController } from "../qq-notifications/QQNotifications";
import type { WeChatRemindersController } from "../wechat/WeChatReminders";
import type { FeedItem } from "./feedModel";

export type FeedSourceStatus = "ok" | "off" | "access" | "auth" | "setup" | "error" | "waiting";

export type FeedSourceState = {
  id: MessageSource;
  label: string;
  status: FeedSourceStatus;
  unread: number;
  error: string | null;
  busy: boolean;
};

export type FeedControllers = {
  qqMail: MailController;
  qqNotifications: QQNotificationsController;
  wechatReminders: WeChatRemindersController;
  imSources?: ImSourcesController;
  enabledSources: Partial<Readonly<Record<MessageSource, boolean>>>;
  onOpenMailSettings?: () => void;
};

export type FeedActions = {
  open: (item: FeedItem) => void;
  read: (items: readonly FeedItem[]) => void;
  readAll: (source?: MessageSource) => void;
  copy: (text: string) => Promise<boolean>;
  openApp: (source: MessageSource) => void;
  clear: (source?: MessageSource) => void;
  refresh: (source?: MessageSource) => void;
  enable: (source: MessageSource) => void;
  fix: (source: MessageSource) => void;
  compose: (() => void) | null;
};

export type MessageFeed = {
  items: FeedItem[];
  sources: FeedSourceState[];
  now: number;
  actions: FeedActions;
};
