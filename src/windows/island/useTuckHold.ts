import { useMemo, useState } from "react";
import type { IslandSettings } from "../../features/appearance/types";
import type { TodoItem } from "../../features/todos/types";
import { hasNewUnreadMail, hasUnreadMessages, holdsTuck, nextMailBaselines, sameBaselines, type MailBaselines } from "./tuckHold";
import type { useIslandNotices } from "./useIslandNotices";

type Notices = Pick<ReturnType<typeof useIslandNotices>, "qqNotifications" | "wechatReminders" | "qqMail" | "preview">;

export function useTuckHold(settings: IslandSettings, { todos, activeTodoId, agentSessions, playing, messagesOpen, notices }: {
  todos: TodoItem[];
  activeTodoId: string | null;
  agentSessions: readonly { phase: string }[];
  playing: boolean;
  messagesOpen: boolean;
  notices: Notices;
}): boolean {
  const { qqNotifications: qq, wechatReminders: wechat, qqMail: mail, preview } = notices;
  const [mailBaselines, setMailBaselines] = useState<MailBaselines>({});
  const baselines = nextMailBaselines(mailBaselines, mail.mailboxes, messagesOpen || preview?.source === "qqMail");
  if (!sameBaselines(baselines, mailBaselines)) setMailBaselines(baselines);
  const messagesUnread = hasUnreadMessages({
    qq: { enabled: qq.snapshot.enabled, count: qq.snapshot.items.length },
    wechat: { enabled: wechat.snapshot.enabled, pending: wechat.snapshot.pending },
    mail: { enabled: settings.mailEnabled, newUnread: hasNewUnreadMail(baselines, mail.mailboxes) },
  });
  const todoInProgress = useMemo(
    () => activeTodoId !== null && todos.some((todo) => todo.id === activeTodoId && !todo.completed),
    [activeTodoId, todos],
  );
  const agentWaiting = agentSessions.some((session) => session.phase === "waiting");
  return holdsTuck(settings, { todoInProgress, agentWaiting, musicPlaying: playing, messagesUnread });
}
