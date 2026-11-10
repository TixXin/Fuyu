import { readJson, writeJson } from "../../../lib/storage.ts";
import { islandRanBefore } from "../../appearance/installState.ts";

export const AGENT_APPROVAL_STORAGE_KEY = "fuyu-agent-approval";

export type AgentApprovalSettings = {
  /** Agents' permission requests wait for a card on the island instead of the terminal prompt. */
  onIsland: boolean;
  /**
   * Also while the session's own terminal or editor is in front. Off, such a request goes straight
   * back to the terminal prompt, which the user is looking at anyway.
   */
  whenInFront: boolean;
};

/** A new install approves on the island, the terminal in front or not. */
export const DEFAULT_AGENT_APPROVAL_SETTINGS: AgentApprovalSettings = { onIsland: true, whenInFront: true };

/**
 * Islands that ran before this setting existed, or before it was on by default, keep it off until
 * their user turns it on: while a request waits, the terminal shows no prompt of its own.
 */
const EARLIER_APPROVAL_SETTINGS: AgentApprovalSettings = { onIsland: false, whenInFront: false };

/** Saved settings as saved; nothing saved is a new install's default. */
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
