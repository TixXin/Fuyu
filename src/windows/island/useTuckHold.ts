import { useState } from "react";
import type { IslandSettings } from "../../lib/settings/types";
import { hasNewUnreadMail, hasUnreadMessages, holdsTuck, mailSeen, nextMailBaselines, sameBaselines, type MailBaselines } from "./tuckHold";
import type { useIslandNotices } from "./useIslandNotices";

type Notices = Pick<ReturnType<typeof useIslandNotices>, "qqNotifications" | "wechatReminders" | "qqMail" | "preview">;

export function useTuckHold(settings: IslandSettings, { messagesOpen, notices }: {
  messagesOpen: boolean;
  notices: Notices;
}): boolean {
  const { qqNotifications: qq, wechatReminders: wechat, qqMail: mail, preview } = notices;
  const [mailBaselines, setMailBaselines] = useState<MailBaselines>({});
  const baselines = nextMailBaselines(mailBaselines, mail.mailboxes, mailSeen({ messagesOpen, previewSource: preview?.source ?? null }));
  if (!sameBaselines(baselines, mailBaselines)) setMailBaselines(baselines);
  const messagesUnread = hasUnreadMessages({
    qq: { enabled: qq.snapshot.enabled, count: qq.snapshot.items.length },
    wechat: { enabled: wechat.snapshot.enabled, pending: wechat.snapshot.pending },
    mail: { enabled: settings.mailEnabled, newUnread: hasNewUnreadMail(baselines, mail.mailboxes) },
  });
  return holdsTuck(settings, { todoInProgress: false, agentWaiting: false, musicPlaying: false, messagesUnread });
}
