import type { IslandSettings } from "../../../lib/settings/types";

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
  mail: { enabled: boolean; newUnread: boolean };
};

export type MailCount = { email: string | null; enabled: boolean; unreadCount: number | null };
export type MailBaselines = Readonly<Record<string, number>>;

export function nextMailBaselines(previous: MailBaselines, boxes: readonly MailCount[], seen: boolean): MailBaselines {
  const next: Record<string, number> = {};
  for (const { email, unreadCount } of boxes) {
    if (!email || unreadCount === null) continue;
    const base = previous[email];
    next[email] = seen || base === undefined ? unreadCount : Math.min(base, unreadCount);
  }
  return next;
}

export function mailSeen(view: { messagesOpen: boolean; previewSource: string | null }): boolean {
  return view.messagesOpen;
}

export function sameBaselines(a: MailBaselines, b: MailBaselines): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

export function hasNewUnreadMail(baselines: MailBaselines, boxes: readonly MailCount[]): boolean {
  return boxes.some(({ email, enabled, unreadCount }) =>
    enabled && email !== null && unreadCount !== null && unreadCount > (baselines[email] ?? unreadCount));
}

export function hasUnreadMessages({ qq, wechat, mail }: UnreadSources): boolean {
  return (qq.enabled && qq.count > 0) || (wechat.enabled && wechat.pending) || (mail.enabled && mail.newUnread);
}

export function holdsTuck(settings: HoldSettings, state: TuckHoldState): boolean {
  return (settings.autoTuckHoldTodo && settings.todoEnabled && state.todoInProgress)
    || (settings.autoTuckHoldAgent && settings.agentStatusEnabled && state.agentWaiting)
    || (settings.autoTuckHoldMusic && settings.musicEnabled && state.musicPlaying)
    || (settings.autoTuckHoldMessages && state.messagesUnread);
}
