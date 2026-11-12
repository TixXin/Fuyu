import { readJson, writeJson } from "../../../lib/storage.ts";
import { islandRanBefore } from "../../appearance/installState.ts";

export const AGENT_APPROVAL_STORAGE_KEY = "fuyu-agent-approval";

export type AgentApprovalSettings = {
  onIsland: boolean;
  whenInFront: boolean;
};

export const DEFAULT_AGENT_APPROVAL_SETTINGS: AgentApprovalSettings = { onIsland: true, whenInFront: true };

const EARLIER_APPROVAL_SETTINGS: AgentApprovalSettings = { onIsland: false, whenInFront: false };

export function normalizeAgentApprovalSettings(value: unknown): AgentApprovalSettings {
  if (!value || typeof value !== "object") return DEFAULT_AGENT_APPROVAL_SETTINGS;
  const saved = value as Record<string, unknown>;
  return { onIsland: saved.onIsland === true, whenInFront: saved.whenInFront === true };
}

export function loadAgentApprovalSettings(): AgentApprovalSettings {
  const saved = readJson(AGENT_APPROVAL_STORAGE_KEY);
  if (saved === undefined && islandRanBefore()) return EARLIER_APPROVAL_SETTINGS;
  return normalizeAgentApprovalSettings(saved);
}

export function saveAgentApprovalSettings(settings: AgentApprovalSettings) {
  writeJson(AGENT_APPROVAL_STORAGE_KEY, settings);
}
