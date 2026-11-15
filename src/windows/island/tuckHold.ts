import type { IslandSettings } from "../../features/appearance/types";

export type TuckHoldState = {
  todoInProgress: boolean;
  agentWaiting: boolean;
  musicPlaying: boolean;
  messagesUnread: boolean;
};

type HoldSettings = Pick<IslandSettings, "autoTuckHoldTodo" | "autoTuckHoldAgent" | "autoTuckHoldMusic" | "autoTuckHoldMessages" | "todoEnabled" | "agentStatusEnabled" | "musicEnabled">;

export type UnreadSources = {
  qq: { enabled: boolean; count: number };
  wechat: { enabled: boolean; pending: boolean };
  mail: { enabled: boolean; unread: number };
};

export function hasUnreadMessages({ qq, wechat, mail }: UnreadSources): boolean {
  return (qq.enabled && qq.count > 0) || (wechat.enabled && wechat.pending) || (mail.enabled && mail.unread > 0);
}

export function holdsTuck(settings: HoldSettings, state: TuckHoldState): boolean {
  return (settings.autoTuckHoldTodo && settings.todoEnabled && state.todoInProgress)
    || (settings.autoTuckHoldAgent && settings.agentStatusEnabled && state.agentWaiting)
    || (settings.autoTuckHoldMusic && settings.musicEnabled && state.musicPlaying)
    || (settings.autoTuckHoldMessages && state.messagesUnread);
}
