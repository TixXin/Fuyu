import { useEffect, useRef } from "react";
import { BUILTIN_MESSAGE_SOURCES, refreshMessageSources, registerMessageSource } from "../host/sources.mjs";
import { imSourceBadge, isImSource } from "../im-sources/imSourcesState";
import type { ImSourcesController } from "../im-sources/useImSources";
import type { MailController } from "../mail/MailPanel";
import type { MessageSource } from "../messagePreview";
import type { QQNotificationsController } from "../qq-notifications/QQNotifications";
import type { WeChatRemindersController } from "../wechat/WeChatReminders";

type SyncInputs = {
  qqNotifications: QQNotificationsController;
  wechatReminders: WeChatRemindersController;
  qqMail: MailController;
  imSources: ImSourcesController;
  enabledSources: Readonly<Record<MessageSource, boolean>>;
};

export function useBuiltinSourcesSync(inputs: SyncInputs) {
  const latestRef = useRef(inputs);
  latestRef.current = inputs;

  useEffect(() => {
    const cleanups = BUILTIN_MESSAGE_SOURCES.map((entry) =>
      registerMessageSource({
        ...entry,
        builtin: true,
        status: () => {
          const cur = latestRef.current;
          const id = entry.id as MessageSource;
          if (id === "qq") {
            const count = cur.qqNotifications.snapshot.items.length;
            return { enabled: cur.enabledSources.qq, unreadCount: count, pending: count > 0 };
          }
          if (id === "wechat") {
            const pending = cur.wechatReminders.snapshot.pending;
            return { enabled: cur.enabledSources.wechat, unreadCount: pending ? 1 : 0, pending };
          }
          if (id === "qqMail") {
            const count = cur.qqMail.unreadTotal;
            return { enabled: cur.enabledSources.qqMail, unreadCount: count, pending: count > 0 };
          }
          if (isImSource(id)) {
            const snap = cur.imSources.snapshots[id];
            const badge = imSourceBadge(snap);
            return {
              enabled: cur.enabledSources[id],
              unreadCount: badge.count,
              pending: badge.count > 0 || badge.dot,
            };
          }
          return { enabled: false, unreadCount: 0, pending: false };
        },
        clear: async () => {
          const cur = latestRef.current;
          const id = entry.id as MessageSource;
          if (id === "qq") await cur.qqNotifications.clear();
          else if (id === "wechat") await cur.wechatReminders.clear();
          else if (isImSource(id)) await cur.imSources.clear(id);
        },
      }),
    );
    return () => {
      for (const off of cleanups) off();
    };
  }, []);

  const summaryKey = JSON.stringify([
    inputs.enabledSources,
    inputs.qqNotifications.snapshot.items.length,
    inputs.wechatReminders.snapshot.pending,
    inputs.qqMail.unreadTotal,
    Object.values(inputs.imSources.snapshots).map((s) => [s.enabled, s.items.length, s.items[0]?.unread ?? null]),
  ]);

  useEffect(() => {
    refreshMessageSources();
  }, [summaryKey]);
}
