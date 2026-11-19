import type { AgentSessionSummary } from "../api.ts";
import { sessionLight } from "../sessionLight.ts";
import type { AgentNoticeButtonOrder, AgentNoticeClick, AgentNoticeMeta, AgentNoticeScrollbar, AgentNoticeStyle } from "../agentSettings.ts";

export type AgentNoticeOptions = {
  style: AgentNoticeStyle;
  messageLines: number;
  commandLines: number;
  markdown: boolean;
  meta: AgentNoticeMeta;
  scrollbar: AgentNoticeScrollbar;
  buttonOrder: AgentNoticeButtonOrder;
  showKeys: boolean;
  click: AgentNoticeClick;
};

export const DEFAULT_AGENT_NOTICE_OPTIONS: AgentNoticeOptions = {
  style: "status",
  messageLines: 6,
  commandLines: 3,
  markdown: true,
  meta: "hover",
  scrollbar: "auto",
  buttonOrder: "allowRight",
  showKeys: true,
  click: "window",
};

export type AgentNoticeSettings = {
  agentNoticeStyle: AgentNoticeStyle;
  agentNoticeMessageLines: number;
  agentNoticeCommandLines: number;
  agentNoticeMarkdown: boolean;
  agentNoticeMeta: AgentNoticeMeta;
  agentNoticeScrollbar: AgentNoticeScrollbar;
  agentNoticeButtonOrder: AgentNoticeButtonOrder;
  agentNoticeShortcuts: boolean;
  agentNoticeClick: AgentNoticeClick;
};

export function noticeOptionsOf(settings: AgentNoticeSettings): AgentNoticeOptions {
  return {
    style: settings.agentNoticeStyle,
    messageLines: settings.agentNoticeMessageLines,
    commandLines: settings.agentNoticeCommandLines,
    markdown: settings.agentNoticeMarkdown,
    meta: settings.agentNoticeMeta,
    scrollbar: settings.agentNoticeScrollbar,
    buttonOrder: settings.agentNoticeButtonOrder,
    showKeys: settings.agentNoticeShortcuts,
    click: settings.agentNoticeClick,
  };
}

export type AgentNoticeTone = "working" | "needs" | "yourTurn" | "done" | "failed";

type ToneFields = Pick<AgentSessionSummary, "phase" | "replyMarker" | "replyAsks" | "backgroundTasks">;

export function noticeTone(session: ToneFields): AgentNoticeTone {
  const light = sessionLight(session);
  return light === "stale" ? "working" : light;
}

export const AUTO_MESSAGE_LINES = 16;
export const HOVER_COMMAND_LINES = 8;

export function messageLineCap(lines: number) {
  return lines > 0 ? lines : AUTO_MESSAGE_LINES;
}

export function approvalCommandLines(lines: number) {
  return lines + 1;
}

export function orderedActions<T>(actions: readonly T[], order: AgentNoticeButtonOrder): T[] {
  return order === "allowLeft" ? [...actions].reverse() : [...actions];
}
