import type { AgentUsage, UsageWindow } from "./api";
import type { HoverCardLine } from "../../components/IslandHoverCard";
import type { ClaudeUsageText } from "../../i18n/sections/claudeUsage";

export const USAGE_STALE_MS = 15 * 60_000;

export type UsageLevel = "low" | "medium" | "high";

export function usageLevel(used: number): UsageLevel {
  return used >= 85 ? "high" : used >= 50 ? "medium" : "low";
}

export function untilReset(resetsAt: number | null, now: number) {
  if (resetsAt === null || resetsAt <= now) return null;
  const minutes = Math.ceil((resetsAt - now) / 60_000);
  return { days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60), minutes: minutes % 60 };
}

export function tightestWindow(usage: AgentUsage): UsageWindow | null {
  const windows = [usage.fiveHour, usage.sevenDay, ...usage.models].filter((window): window is UsageWindow => window !== null);
  return windows.reduce<UsageWindow | null>((tightest, window) => (tightest === null || window.used > tightest.used ? window : tightest), null);
}

export function isStale(usage: AgentUsage, now: number) {
  return usage.updatedAt !== null && now - usage.updatedAt > USAGE_STALE_MS;
}

export function usageSourceLines(usage: AgentUsage, now: number, text: ClaudeUsageText): HoverCardLine[] {
  const lines: HoverCardLine[] = [];
  const plan = usage.source === "glm" || usage.source === "kimi";
  if (usage.error) lines.push({ text: (plan ? text.planErrors : text.errors)[usage.error.kind] });
  if (usage.updatedAt !== null) {
    const minutes = Math.max(0, Math.floor((now - usage.updatedAt) / 60_000));
    const source = { api: text.fromApi, magpie: text.fromMagpie, codex: text.fromCodex, hud: text.fromHud, glm: text.fromGlm, kimi: text.fromKimi }[usage.source ?? "hud"];
    lines.push({ text: text.updated(text.updatedAgo(minutes), source), muted: true });
  }
  return lines;
}

export type AgentUsages = { claude: AgentUsage | null; codex: AgentUsage | null; readAt: number };

export const EMPTY_USAGES: AgentUsages = { claude: null, codex: null, readAt: 0 };

export function hasUsageNumbers(usage: AgentUsage | null): boolean {
  return Boolean(usage && (usage.fiveHour || usage.sevenDay || usage.models.length > 0));
}

export function usageLineCount(usages: AgentUsages): number {
  return Number(hasUsageNumbers(usages.claude)) + Number(hasUsageNumbers(usages.codex));
}
