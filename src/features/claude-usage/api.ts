import { invoke } from "@tauri-apps/api/core";
import type { AgentUsage, AgentUsageError } from "../../lib/agent-usage/types";

export function refreshClaudeUsage() {
  return invoke<void>("refresh_claude_usage");
}

export type PlanProvider = "glm" | "kimi";

export function getPlanUsage(provider: PlanProvider, refresh = false) {
  return invoke<AgentUsage>("get_plan_usage", { provider, refresh });
}

export function getAntigravityUsage(refresh = false) {
  return invoke<AgentUsage>("get_antigravity_usage", { refresh });
}

export function getCursorUsage(refresh = false) {
  return invoke<AgentUsage>("get_cursor_usage", { refresh });
}

export type HoverProviderId = "workbuddy" | "dsh";

export type WorkbuddyCredits = {
  today: number;
  sevenDay: number;
  total: number;
  totalTokens: number;
  sessions: number;
};

export type DshWallet = {
  currency: string;
  total: string;
  toppedUp: string;
  granted: string;
};

export type HoverUsage = {
  provider: HoverProviderId;
  updatedAt: number | null;
  source: string | null;
  available: boolean | null;
  credits: WorkbuddyCredits | null;
  wallets: DshWallet[];
  error: AgentUsageError | null;
};

export function getHoverUsage(provider: HoverProviderId, refresh = false) {
  return invoke<HoverUsage>("get_hover_usage", { provider, refresh });
}

export function setPlanKey(provider: PlanProvider, key: string) {
  return invoke<boolean>("set_plan_key", { provider, key });
}

export function hasPlanKey(provider: PlanProvider) {
  return invoke<boolean>("has_plan_key", { provider });
}
