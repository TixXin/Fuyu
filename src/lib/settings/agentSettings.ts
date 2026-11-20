import { AGENT_ALERT_SECONDS, oneOf } from "./settingsLimits.ts";
import type { LegacyIslandSettings } from "./types";

export type AgentHostDisplay = "both" | "icon" | "name" | "off";
export type AgentSessionView = "list" | "cards" | "compact";
export type AgentSessionSort = "status" | "recent" | "firstSeen";
export type AgentSessionGroup = "computer" | "project" | "none";
export type AgentArchiveMotion = "slide" | "dissolve";
export type AgentCardEffects = "off" | "sparkle" | "gradient" | "orbit";
export type AgentAlertStarted = "everyTurn" | "newSession" | "off" | "hidden";
export type AgentNoticeStyle = "status" | "compact" | "wings";
export type AgentNoticeNotch = "band" | "below";
export type AgentNoticeMeta = "hover" | "inline";
export type AgentNoticeScrollbar = "auto" | "always";
export type AgentNoticeClick = "window" | "page";
export type AgentNoticeStack = "peek" | "count" | "wings";
export type AgentNoticeButtonOrder = "allowRight" | "allowLeft";

export const AGENT_HOST_DISPLAYS: readonly AgentHostDisplay[] = ["both", "icon", "name", "off"];
export const AGENT_SESSION_VIEWS: readonly AgentSessionView[] = ["list", "cards", "compact"];
export const AGENT_SESSION_SORTS: readonly AgentSessionSort[] = ["status", "recent", "firstSeen"];
export const AGENT_SESSION_GROUPS: readonly AgentSessionGroup[] = ["computer", "project", "none"];
export const AGENT_ARCHIVE_MOTIONS: readonly AgentArchiveMotion[] = ["slide", "dissolve"];
export const AGENT_CARD_EFFECTS: readonly AgentCardEffects[] = ["off", "sparkle", "gradient", "orbit"];
export const AGENT_ALERT_STARTED: readonly AgentAlertStarted[] = ["everyTurn", "newSession", "off", "hidden"];
export const AGENT_NOTICE_STYLES: readonly AgentNoticeStyle[] = ["status", "compact", "wings"];
export const AGENT_NOTICE_NOTCHES: readonly AgentNoticeNotch[] = ["band", "below"];
export const AGENT_NOTICE_METAS: readonly AgentNoticeMeta[] = ["hover", "inline"];
export const AGENT_NOTICE_SCROLLBARS: readonly AgentNoticeScrollbar[] = ["auto", "always"];
export const AGENT_NOTICE_CLICKS: readonly AgentNoticeClick[] = ["window", "page"];
export const AGENT_NOTICE_STACKS: readonly AgentNoticeStack[] = ["peek", "count", "wings"];
export const AGENT_NOTICE_BUTTON_ORDERS: readonly AgentNoticeButtonOrder[] = ["allowRight", "allowLeft"];
export const AGENT_NOTICE_MESSAGE_LINES = [4, 6, 8, 12, 0] as const;
export const AGENT_NOTICE_COMMAND_LINES = [1, 2, 3, 5] as const;
export const AGENT_NOTICE_YOUR_TURN_SECONDS = [0, 15, 30] as const;
export const AGENT_NOTICE_FAILED_SECONDS = [0, 10, 30] as const;
export const AGENT_SESSION_HOURS = [1, 2, 6, 24] as const;
export const AGENT_REMIND_SECONDS = [0, 30, 60, 120, 300] as const;
export const AGENT_QUOTA_ALERT_PERCENTS = [0, 70, 80, 90] as const;

export type AgentSettingValues = {
  agentHostDisplay: AgentHostDisplay;
  agentSessionView: AgentSessionView;
  agentSessionSort: AgentSessionSort;
  agentSessionGroup: AgentSessionGroup;
  agentArchiveMotion: AgentArchiveMotion;
  agentCardEffects: AgentCardEffects;
  agentSessionHours: number;
  agentHiddenProviders: string[];
  agentHideFinished: boolean;
  agentHideClosed: boolean;
  agentShowElapsed: boolean;
  agentShowModel: boolean;
  agentShowActivity: boolean;
  agentShowUsage: boolean;
  agentExpandChildren: boolean;
  agentAlertCompleted: boolean;
  agentAlertFailed: boolean;
  agentAlertWaiting: boolean;
  agentAlertStarted: AgentAlertStarted;
  agentAlertSeconds: number;
  agentRemindSeconds: number;
  agentQuotaAlertPercent: number;
  agentNoticeStyle: AgentNoticeStyle;
  agentNoticeNotch: AgentNoticeNotch;
  agentNoticeMessageLines: number;
  agentNoticeCommandLines: number;
  agentNoticeMarkdown: boolean;
  agentNoticeMeta: AgentNoticeMeta;
  agentNoticeScrollbar: AgentNoticeScrollbar;
  agentNoticeYourTurnSeconds: number;
  agentNoticeFailedSeconds: number;
  agentNoticeHoverHold: boolean;
  agentNoticeClick: AgentNoticeClick;
  agentNoticeStack: AgentNoticeStack;
  agentNoticeButtonOrder: AgentNoticeButtonOrder;
  agentNoticeShortcuts: boolean;
  agentHooksAutoInstall: boolean;
  agentHooksAutoUpdate: boolean;
};

export const DEFAULT_AGENT_SETTINGS: AgentSettingValues = {
  agentHostDisplay: "icon",
  agentSessionView: "cards",
  agentSessionSort: "status",
  agentSessionGroup: "computer",
  agentArchiveMotion: "dissolve",
  agentCardEffects: "sparkle",
  agentSessionHours: 24,
  agentHiddenProviders: [],
  agentHideFinished: false,
  agentHideClosed: true,
  agentShowElapsed: false,
  agentShowModel: true,
  agentShowActivity: true,
  agentShowUsage: true,
  agentExpandChildren: false,
  agentAlertCompleted: true,
  agentAlertFailed: true,
  agentAlertWaiting: true,
  agentAlertStarted: "off",
  agentAlertSeconds: 3,
  agentRemindSeconds: 0,
  agentQuotaAlertPercent: 80,
  agentNoticeStyle: "status",
  agentNoticeNotch: "band",
  agentNoticeMessageLines: 6,
  agentNoticeCommandLines: 3,
  agentNoticeMarkdown: true,
  agentNoticeMeta: "hover",
  agentNoticeScrollbar: "auto",
  agentNoticeYourTurnSeconds: 0,
  agentNoticeFailedSeconds: 0,
  agentNoticeHoverHold: true,
  agentNoticeClick: "window",
  agentNoticeStack: "peek",
  agentNoticeButtonOrder: "allowRight",
  agentNoticeShortcuts: true,
  agentHooksAutoInstall: true,
  agentHooksAutoUpdate: true,
};

export const LEGACY_AGENT_FALLBACKS = {
  agentAlertSeconds: 5,
  agentRemindSeconds: 60,
  agentAlertStarted: "everyTurn",
} as const satisfies Partial<AgentSettingValues>;

export function normalizeAgentSettings(settings: LegacyIslandSettings | null | undefined) {
  return {
    agentHostDisplay: AGENT_HOST_DISPLAYS.includes(settings?.agentHostDisplay as AgentHostDisplay)
      ? (settings?.agentHostDisplay as AgentHostDisplay)
      : DEFAULT_AGENT_SETTINGS.agentHostDisplay,
    agentSessionView: oneOf(AGENT_SESSION_VIEWS, settings?.agentSessionView, DEFAULT_AGENT_SETTINGS.agentSessionView),
    agentSessionSort: oneOf(AGENT_SESSION_SORTS, settings?.agentSessionSort, DEFAULT_AGENT_SETTINGS.agentSessionSort),
    agentSessionGroup: oneOf(AGENT_SESSION_GROUPS, settings?.agentSessionGroup, DEFAULT_AGENT_SETTINGS.agentSessionGroup),
    agentArchiveMotion: oneOf(AGENT_ARCHIVE_MOTIONS, settings?.agentArchiveMotion, DEFAULT_AGENT_SETTINGS.agentArchiveMotion),
    agentCardEffects: oneOf(AGENT_CARD_EFFECTS, settings?.agentCardEffects, DEFAULT_AGENT_SETTINGS.agentCardEffects),
    agentSessionHours: oneOf(AGENT_SESSION_HOURS, settings?.agentSessionHours, DEFAULT_AGENT_SETTINGS.agentSessionHours),
    agentHiddenProviders: normalizeHiddenProviders(settings),
    agentHideFinished: settings?.agentHideFinished === true,
    agentHideClosed: settings?.agentHideClosed !== false,
    agentHooksAutoInstall: settings?.agentHooksAutoInstall !== false,
    agentHooksAutoUpdate: settings?.agentHooksAutoUpdate !== false,
    agentShowElapsed: settings?.agentShowElapsed === true,
    agentShowModel: settings?.agentShowModel !== false,
    agentShowActivity: settings?.agentShowActivity !== false,
    agentShowUsage: settings?.agentShowUsage !== false,
    agentExpandChildren: settings?.agentExpandChildren === true,
    agentAlertCompleted: settings?.agentAlertCompleted !== false,
    agentAlertFailed: settings?.agentAlertFailed !== false,
    agentAlertWaiting: settings?.agentAlertWaiting !== false,
    agentAlertStarted: oneOf(AGENT_ALERT_STARTED, settings?.agentAlertStarted, LEGACY_AGENT_FALLBACKS.agentAlertStarted),
    agentAlertSeconds: oneOf(AGENT_ALERT_SECONDS, settings?.agentAlertSeconds, LEGACY_AGENT_FALLBACKS.agentAlertSeconds),
    agentRemindSeconds: oneOf(AGENT_REMIND_SECONDS, settings?.agentRemindSeconds, LEGACY_AGENT_FALLBACKS.agentRemindSeconds),
    agentQuotaAlertPercent: oneOf(AGENT_QUOTA_ALERT_PERCENTS, settings?.agentQuotaAlertPercent, DEFAULT_AGENT_SETTINGS.agentQuotaAlertPercent),
    agentNoticeStyle: oneOf(AGENT_NOTICE_STYLES, settings?.agentNoticeStyle, DEFAULT_AGENT_SETTINGS.agentNoticeStyle),
    agentNoticeNotch: oneOf(AGENT_NOTICE_NOTCHES, settings?.agentNoticeNotch, DEFAULT_AGENT_SETTINGS.agentNoticeNotch),
    agentNoticeMessageLines: oneOf(AGENT_NOTICE_MESSAGE_LINES, settings?.agentNoticeMessageLines, DEFAULT_AGENT_SETTINGS.agentNoticeMessageLines),
    agentNoticeCommandLines: oneOf(AGENT_NOTICE_COMMAND_LINES, settings?.agentNoticeCommandLines, DEFAULT_AGENT_SETTINGS.agentNoticeCommandLines),
    agentNoticeMarkdown: settings?.agentNoticeMarkdown !== false,
    agentNoticeMeta: oneOf(AGENT_NOTICE_METAS, settings?.agentNoticeMeta, DEFAULT_AGENT_SETTINGS.agentNoticeMeta),
    agentNoticeScrollbar: oneOf(AGENT_NOTICE_SCROLLBARS, settings?.agentNoticeScrollbar, DEFAULT_AGENT_SETTINGS.agentNoticeScrollbar),
    agentNoticeYourTurnSeconds: oneOf(AGENT_NOTICE_YOUR_TURN_SECONDS, settings?.agentNoticeYourTurnSeconds, DEFAULT_AGENT_SETTINGS.agentNoticeYourTurnSeconds),
    agentNoticeFailedSeconds: oneOf(AGENT_NOTICE_FAILED_SECONDS, settings?.agentNoticeFailedSeconds, DEFAULT_AGENT_SETTINGS.agentNoticeFailedSeconds),
    agentNoticeHoverHold: settings?.agentNoticeHoverHold !== false,
    agentNoticeClick: oneOf(AGENT_NOTICE_CLICKS, settings?.agentNoticeClick, DEFAULT_AGENT_SETTINGS.agentNoticeClick),
    agentNoticeStack: oneOf(AGENT_NOTICE_STACKS, settings?.agentNoticeStack, DEFAULT_AGENT_SETTINGS.agentNoticeStack),
    agentNoticeButtonOrder: oneOf(AGENT_NOTICE_BUTTON_ORDERS, settings?.agentNoticeButtonOrder, DEFAULT_AGENT_SETTINGS.agentNoticeButtonOrder),
    agentNoticeShortcuts: settings?.agentNoticeShortcuts !== false,
  } satisfies Partial<AgentSettingValues>;
}

function normalizeHiddenProviders(settings: LegacyIslandSettings | null | undefined): string[] {
  const saved = settings?.agentHiddenProviders;
  if (Array.isArray(saved)) {
    return [...new Set(saved.filter((provider): provider is string => typeof provider === "string" && provider.length > 0))];
  }
  return [
    ...(settings?.agentShowClaudeCode === false ? ["claudeCode"] : []),
    ...(settings?.agentShowCodex === false ? ["codex"] : []),
  ];
}
