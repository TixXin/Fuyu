import { DEFAULT_AGENT_SETTINGS } from "./agentSettings.ts";
import type { AgentSettingValues } from "./agentSettings";

export const AGENT_NOTICE_KEYS = [
  "agentNoticeStyle",
  "agentNoticeNotch",
  "agentNoticeMessageLines",
  "agentNoticeCommandLines",
  "agentNoticeMarkdown",
  "agentNoticeMeta",
  "agentNoticeScrollbar",
  "agentAlertStarted",
  "agentNoticeYourTurnSeconds",
  "agentNoticeFailedSeconds",
  "agentAlertSeconds",
  "agentNoticeHoverHold",
  "agentNoticeClick",
  "agentNoticeStack",
  "agentNoticeButtonOrder",
  "agentNoticeShortcuts",
] as const satisfies readonly (keyof AgentSettingValues)[];

export type AgentNoticeKey = (typeof AGENT_NOTICE_KEYS)[number];

export type AgentNoticeValues = Pick<AgentSettingValues, AgentNoticeKey>;

export function agentNoticeDefaults(): AgentNoticeValues {
  return Object.fromEntries(AGENT_NOTICE_KEYS.map((key) => [key, DEFAULT_AGENT_SETTINGS[key]])) as AgentNoticeValues;
}

export function isAgentNoticeDefault(settings: AgentNoticeValues) {
  return AGENT_NOTICE_KEYS.every((key) => settings[key] === DEFAULT_AGENT_SETTINGS[key]);
}
