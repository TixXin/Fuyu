import { AGENT_ALERT_SECONDS, oneOf } from "./settingsLimits.ts";
import type { LegacyIslandSettings } from "./types";

export type AgentHostDisplay = "both" | "icon" | "name" | "off";
export type AgentSessionView = "list" | "cards" | "compact";
export type AgentSessionSort = "status" | "recent" | "firstSeen";
export type AgentSessionGroup = "computer" | "project" | "none";
export type AgentArchiveMotion = "slide" | "dissolve";
export type AgentCardEffects = "off" | "sparkle" | "gradient" | "orbit";
export type AgentAlertStarted = "everyTurn" | "newSession" | "off";

export const AGENT_HOST_DISPLAYS: readonly AgentHostDisplay[] = ["both", "icon", "name", "off"];
export const AGENT_SESSION_VIEWS: readonly AgentSessionView[] = ["list", "cards", "compact"];
export const AGENT_SESSION_SORTS: readonly AgentSessionSort[] = ["status", "recent", "firstSeen"];
export const AGENT_SESSION_GROUPS: readonly AgentSessionGroup[] = ["computer", "project", "none"];
export const AGENT_ARCHIVE_MOTIONS: readonly AgentArchiveMotion[] = ["slide", "dissolve"];
export const AGENT_CARD_EFFECTS: readonly AgentCardEffects[] = ["off", "sparkle", "gradient", "orbit"];
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
  agentAlertStarted: "everyTurn",
  agentAlertSeconds: 3,
  agentRemindSeconds: 0,
  agentQuotaAlertPercent: 80,
};

export const LEGACY_AGENT_FALLBACKS = {
  agentAlertSeconds: 5,
  agentRemindSeconds: 60,
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
    agentShowElapsed: settings?.agentShowElapsed === true,
    agentShowModel: settings?.agentShowModel !== false,
    agentShowActivity: settings?.agentShowActivity !== false,
    agentShowUsage: settings?.agentShowUsage !== false,
    agentExpandChildren: settings?.agentExpandChildren === true,
    agentAlertCompleted: settings?.agentAlertCompleted !== false,
    agentAlertFailed: settings?.agentAlertFailed !== false,
    agentAlertWaiting: settings?.agentAlertWaiting !== false,
    agentAlertStarted: settings?.agentAlertStarted === "newSession" || settings?.agentAlertStarted === "off" ? settings.agentAlertStarted : "everyTurn",
    agentAlertSeconds: oneOf(AGENT_ALERT_SECONDS, settings?.agentAlertSeconds, LEGACY_AGENT_FALLBACKS.agentAlertSeconds),
    agentRemindSeconds: oneOf(AGENT_REMIND_SECONDS, settings?.agentRemindSeconds, LEGACY_AGENT_FALLBACKS.agentRemindSeconds),
    agentQuotaAlertPercent: oneOf(AGENT_QUOTA_ALERT_PERCENTS, settings?.agentQuotaAlertPercent, DEFAULT_AGENT_SETTINGS.agentQuotaAlertPercent),
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
