import type { IslandSettings } from "../../../lib/settings/types";
import type { AgentNoticeTone } from "../notice/noticeOptions.ts";
import type { AgentSoundEvent } from "../sounds/events.ts";

export const PREVIEW_EVENTS = ["approval", "question", "yourTurn", "done", "failed", "started", "stack"] as const;

export type PreviewEvent = (typeof PREVIEW_EVENTS)[number];

export const PREVIEW_TONE: Record<PreviewEvent, AgentNoticeTone> = {
  approval: "needs",
  question: "yourTurn",
  yourTurn: "yourTurn",
  done: "done",
  failed: "failed",
  started: "working",
  stack: "failed",
};

export const PREVIEW_SOUND: Record<PreviewEvent, AgentSoundEvent> = {
  approval: "approval",
  question: "question",
  yourTurn: "question",
  done: "complete",
  failed: "error",
  started: "start",
  stack: "error",
};

export type PreviewShow = "card" | "title" | "none";

export type PreviewStay = "handled" | "looked" | number;

export type PreviewSwitch = "agentAlertWaiting" | "agentAlertCompleted" | "agentAlertFailed";

type AlertValues = Pick<
  IslandSettings,
  PreviewSwitch | "agentAlertStarted" | "agentAlertSeconds" | "agentNoticeYourTurnSeconds" | "agentNoticeFailedSeconds"
>;

export function previewSwitch(event: PreviewEvent): PreviewSwitch | null {
  if (event === "approval" || event === "question" || event === "yourTurn") return "agentAlertWaiting";
  if (event === "done") return "agentAlertCompleted";
  if (event === "failed") return "agentAlertFailed";
  return null;
}

export function previewShow(event: PreviewEvent, settings: AlertValues): PreviewShow {
  if (event === "started") {
    if (settings.agentAlertStarted === "everyTurn" || settings.agentAlertStarted === "newSession") return "card";
    return settings.agentAlertStarted === "off" ? "title" : "none";
  }
  const key = previewSwitch(event);
  return !key || settings[key] ? "card" : "none";
}

export function previewStay(event: PreviewEvent, settings: AlertValues): PreviewStay {
  if (event === "approval" || event === "question") return "handled";
  if (event === "yourTurn") return settings.agentNoticeYourTurnSeconds > 0 ? settings.agentNoticeYourTurnSeconds : "looked";
  if (event === "failed" || event === "stack") return settings.agentNoticeFailedSeconds > 0 ? settings.agentNoticeFailedSeconds : "looked";
  return settings.agentAlertSeconds;
}

const MESSAGE_EVENTS: readonly PreviewEvent[] = ["done", "yourTurn", "failed", "stack"];

const FOCUS: Partial<Record<keyof IslandSettings, readonly PreviewEvent[]>> = {
  agentNoticeMessageLines: MESSAGE_EVENTS,
  agentNoticeMarkdown: MESSAGE_EVENTS,
  agentNoticeScrollbar: MESSAGE_EVENTS,
  agentNoticeCommandLines: ["approval", "started"],
  agentNoticeButtonOrder: ["approval"],
  agentNoticeShortcuts: ["approval", "question"],
  agentNoticeStack: ["stack"],
  agentRemindSeconds: ["approval", "question"],
  agentNoticeYourTurnSeconds: ["yourTurn"],
  agentNoticeFailedSeconds: ["failed", "stack"],
  agentAlertSeconds: ["done", "started"],
  agentAlertStarted: ["started"],
  agentAlertWaiting: ["approval", "question", "yourTurn"],
  agentAlertCompleted: ["done"],
  agentAlertFailed: ["failed"],
};

export function focusedEvent(current: PreviewEvent, changed: readonly string[]): PreviewEvent {
  for (const key of changed) {
    const events = FOCUS[key as keyof IslandSettings];
    if (events && !events.includes(current)) return events[0];
  }
  return current;
}

export const PLAY_MAX_SECONDS = 6;
export const PLAY_REMIND_MS = 3000;
export const PLAY_COLLAPSED_MS = 650;
export const PLAY_ENDED_MS = 9000;

export function playSeconds(stay: number) {
  return Math.min(stay, PLAY_MAX_SECONDS);
}
