import { useMemo } from "react";
import type { IslandSettings } from "../../features/appearance/types";
import type { TodoItem } from "../../features/todos/types";
import { hasUnreadMessages, holdsTuck } from "./tuckHold";
import type { useIslandNotices } from "./useIslandNotices";

type Notices = Pick<ReturnType<typeof useIslandNotices>, "qqNotifications" | "wechatReminders" | "qqMail">;

export function useTuckHold(settings: IslandSettings, { todos, activeTodoId, agentSessions, playing, notices }: {
  todos: TodoItem[];
  activeTodoId: string | null;
  agentSessions: readonly { phase: string }[];
  playing: boolean;
  notices: Notices;
}): boolean {
  const { qqNotifications: qq, wechatReminders: wechat, qqMail: mail } = notices;
  const messagesUnread = hasUnreadMessages({
    qq: { enabled: qq.snapshot.enabled, count: qq.snapshot.items.length },
    wechat: { enabled: wechat.snapshot.enabled, pending: wechat.snapshot.pending },
    mail: { enabled: settings.mailEnabled, unread: mail.unreadTotal },
  });
  const todoInProgress = useMemo(
    () => activeTodoId !== null && todos.some((todo) => todo.id === activeTodoId && !todo.completed),
    [activeTodoId, todos],
  );
  const agentWaiting = agentSessions.some((session) => session.phase === "waiting");
  return holdsTuck(settings, { todoInProgress, agentWaiting, musicPlaying: playing, messagesUnread });
}
