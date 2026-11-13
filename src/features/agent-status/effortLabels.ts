import type { AgentProvider, SessionProvider } from "./api";

export type AgentEffortLabels = Partial<Record<AgentProvider, Record<string, string>>>;

export function shownEffort(provider: SessionProvider, effort: string | null, labels: AgentEffortLabels): string | null {
  if (!effort) return effort;
  if (provider === "workbuddy" || provider === "antigravity") return effort;
  return labels[provider]?.[effort.trim().toLowerCase()] ?? effort;
}
