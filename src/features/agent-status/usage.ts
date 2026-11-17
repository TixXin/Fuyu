import type { AgentUsage, UsageWindow } from "./api";

export { isStale, liveUsage, untilReset, USAGE_STALE_MS, usageSourceLines } from "../../lib/agent-usage/usage.ts";

export type UsageLevel = "low" | "medium" | "high";

export function usageLevel(used: number): UsageLevel {
  return used >= 85 ? "high" : used >= 50 ? "medium" : "low";
}

export function tightestWindow(usage: AgentUsage): UsageWindow | null {
  const windows = [usage.fiveHour, usage.sevenDay, ...usage.models].filter((window): window is UsageWindow => window !== null);
  return windows.reduce<UsageWindow | null>((tightest, window) => (tightest === null || window.used > tightest.used ? window : tightest), null);
}

export type AgentUsages = { claude: AgentUsage | null; codex: AgentUsage | null; readAt: number };

export const EMPTY_USAGES: AgentUsages = { claude: null, codex: null, readAt: 0 };

export function hasUsageNumbers(usage: AgentUsage | null): boolean {
  return Boolean(usage && (usage.fiveHour || usage.sevenDay || usage.models.length > 0));
}

export function usageLineCount(usages: AgentUsages): number {
  return Number(hasUsageNumbers(usages.claude)) + Number(hasUsageNumbers(usages.codex));
}

export type UsageWindowCell = { key: string; label: string; window: UsageWindow };

export function usageWindows(usage: AgentUsage, labels: { fiveHour: string; sevenDay: string }): UsageWindowCell[] {
  return [
    ...(usage.fiveHour ? [{ key: "fiveHour", label: labels.fiveHour, window: usage.fiveHour }] : []),
    ...(usage.sevenDay ? [{ key: "sevenDay", label: labels.sevenDay, window: usage.sevenDay }] : []),
    ...usage.models.map((model, index) => ({ key: `model:${index}`, label: model.name, window: model })),
  ];
}

export type UsageColumns = { template: string; of: (key: string) => number; reset: number; stale: number };

export function usageColumns(usages: readonly AgentUsage[]): UsageColumns {
  const keys = [
    ...(usages.some((usage) => usage.fiveHour) ? ["fiveHour"] : []),
    ...(usages.some((usage) => usage.sevenDay) ? ["sevenDay"] : []),
    ...Array.from({ length: Math.max(0, ...usages.map((usage) => usage.models.length)) }, (_, index) => `model:${index}`),
  ];
  return {
    template: ["14px", ...keys.map(() => "auto"), "minmax(0, 1fr)", "auto"].join(" "),
    of: (key) => keys.indexOf(key) + 2,
    reset: keys.length + 2,
    stale: keys.length + 3,
  };
}
