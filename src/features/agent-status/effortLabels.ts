import type { AgentProvider, SessionProvider } from "./api";

const VERBATIM_EFFORT = ["workbuddy", "antigravity", "dsh", "opencode", "qoder", "codebuddy", "qwen", "trae", "traeCn", "zcode"] as const;

function isVerbatim(provider: SessionProvider): provider is (typeof VERBATIM_EFFORT)[number] {
  return VERBATIM_EFFORT.some((known) => known === provider);
}

export type AgentEffortLabels = Partial<Record<AgentProvider, Record<string, string>>>;

export function shownEffort(provider: SessionProvider, effort: string | null, labels: AgentEffortLabels): string | null {
  if (!effort) return effort;
  if (isVerbatim(provider)) return effort;
  return labels[provider]?.[effort.trim().toLowerCase()] ?? effort;
}
