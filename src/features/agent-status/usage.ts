import type { AgentUsage, UsageWindow } from "./api";
import type { HoverCardLine } from "../../components/IslandHoverCard";
import type { ClaudeUsageText } from "../../i18n/sections/claudeUsage";
import { formatAge } from "../../components/list/formatAgo.ts";

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

export function liveUsage(usage: AgentUsage, now: number): AgentUsage {
  const updatedAt = usage.updatedAt;
  if (updatedAt === null) return usage;
  const live = (window: UsageWindow | null) => (window && window.resetsAt !== null && updatedAt < window.resetsAt && window.resetsAt <= now ? null : window);
  return {
    ...usage,
    fiveHour: live(usage.fiveHour),
    sevenDay: live(usage.sevenDay),
    models: usage.models.filter((window) => live(window) !== null),
  };
}

export function usageSourceLines(usage: AgentUsage, now: number, text: ClaudeUsageText): HoverCardLine[] {
  const lines: HoverCardLine[] = [];
  const plan = usage.source === "glm" || usage.source === "kimi";
  if (usage.error) lines.push({ text: (plan ? text.planErrors : text.errors)[usage.error.kind] });
  if (usage.updatedAt !== null) {
    const kind = usage.source ?? "hud";
    const source = { api: text.fromApi, magpie: text.fromMagpie, codex: text.fromCodex, hud: text.fromHud, glm: text.fromGlm, kimi: text.fromKimi }[kind];
    const ago = formatAge(Math.max(0, now - usage.updatedAt), text.ago);
    if (isStale(usage, now)) {
      lines.push({ text: text.staleUpdated(ago, source) });
      const reason = kind === "hud" || kind === "codex" ? text.staleReason[kind] : undefined;
      if (reason) lines.push({ text: reason, muted: true });
    } else {
      lines.push({ text: text.updated(ago, source), muted: true });
    }
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
