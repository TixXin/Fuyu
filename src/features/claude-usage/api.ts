import { invoke } from "@tauri-apps/api/core";
import type { AgentUsage } from "../../lib/agent-usage/types";

export function refreshClaudeUsage() {
  return invoke<void>("refresh_claude_usage");
}

export type PlanProvider = "glm" | "kimi";

export function getPlanUsage(provider: PlanProvider, refresh = false) {
  return invoke<AgentUsage>("get_plan_usage", { provider, refresh });
}

export function setPlanKey(provider: PlanProvider, key: string) {
  return invoke<boolean>("set_plan_key", { provider, key });
}

export function hasPlanKey(provider: PlanProvider) {
  return invoke<boolean>("has_plan_key", { provider });
}
