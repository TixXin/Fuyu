import type { AgentProvider, SessionProvider } from "./api";

const VERBATIM_EFFORT = ["workbuddy", "antigravity", "dsh", "opencode", "qoder", "codebuddy", "qwen", "trae", "traeCn", "zcode", "kimiCode", "mimo", "grok", "copilot", "droid", "pi"] as const;

function isVerbatim(provider: SessionProvider | string): provider is (typeof VERBATIM_EFFORT)[number] {
  return VERBATIM_EFFORT.some((known) => known === provider) || (provider !== "claudeCode" && provider !== "codex");
}

export type AgentEffortLabels = Partial<Record<AgentProvider, Record<string, string>>>;

export function shownEffort(provider: SessionProvider | string, effort: string | null, labels: AgentEffortLabels): string | null {
  if (!effort) return effort;
  if (isVerbatim(provider)) return effort;
  return labels[provider as AgentProvider]?.[effort.trim().toLowerCase()] ?? effort;
}
