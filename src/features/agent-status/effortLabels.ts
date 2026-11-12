import type { AgentProvider } from "./api";

export type AgentEffortLabels = Partial<Record<AgentProvider, Record<string, string>>>;

export function shownEffort(provider: AgentProvider, effort: string | null, labels: AgentEffortLabels): string | null {
  if (!effort) return effort;
  return labels[provider]?.[effort.trim().toLowerCase()] ?? effort;
}
