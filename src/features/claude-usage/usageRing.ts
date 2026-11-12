import type { AgentUsage, UsageWindow } from "../agent-status/api";
import { untilReset, usageSourceLines } from "../agent-status/usage.ts";
import type { HoverCardLine } from "../../components/IslandHoverCard";
import type { MiniRingTrack } from "../../components/MiniRing";
import type { ClaudeUsageText } from "../../i18n/sections/claudeUsage";

export const CLAUDE_USAGE_RING_SIZE = 24;
export const CLAUDE_USAGE_GAUGE_WIDTH = CLAUDE_USAGE_RING_SIZE + 6;

export const USAGE_STALE_MS = 15 * 60_000;

export const USAGE_COLORS = {
  normal: "var(--usage-claude)",
  warn: "var(--usage-warn)",
  danger: "var(--usage-danger)",
  stale: "var(--usage-stale)",
} as const;

export type UsageProviderId = "claudeCode" | "codex" | "glm" | "kimi";

export const USAGE_PROVIDERS: readonly { id: UsageProviderId; name: string; color: string; defaultOn: boolean }[] = [
  { id: "claudeCode", name: "Claude Code", color: USAGE_COLORS.normal, defaultOn: true },
  { id: "codex", name: "Codex", color: "var(--usage-codex)", defaultOn: false },
  { id: "glm", name: "GLM", color: "var(--usage-glm)", defaultOn: false },
  { id: "kimi", name: "Kimi", color: "var(--usage-kimi)", defaultOn: false },
];

export type UsageProvider = (typeof USAGE_PROVIDERS)[number];

export const usageItemId = (provider: Pick<UsageProvider, "id">) => `usage:${provider.id}`;

export function shownUsageProviders(settings: Record<string, unknown>): UsageProvider[] {
  return USAGE_PROVIDERS.filter(({ id, defaultOn }) => (typeof settings[id] === "boolean" ? settings[id] : defaultOn));
}

export function isUsageStale(usage: AgentUsage | null, now: number) {
  return usage === null || (usage.updatedAt !== null && now - usage.updatedAt > USAGE_STALE_MS);
}

export function usageColor(percent: number, stale: boolean, normal: string = USAGE_COLORS.normal) {
  if (stale) return USAGE_COLORS.stale;
  if (percent >= 90) return USAGE_COLORS.danger;
  if (percent >= 70) return USAGE_COLORS.warn;
  return normal;
}

export function shownPercent(used: number, remaining: boolean) {
  return remaining ? Math.max(0, 100 - used) : used;
}

function longWindow(usage: AgentUsage | null) {
  return usage?.sevenDay ?? usage?.models.find((window) => window.name === "month") ?? null;
}

export function usageRings(usage: AgentUsage | null, now: number, remaining = false, normal: string = USAGE_COLORS.normal): MiniRingTrack[] {
  const stale = isUsageStale(usage, now);
  return [usage?.fiveHour ?? null, longWindow(usage)].map((limit) =>
    limit
      ? { value: shownPercent(limit.used, remaining) / 100, color: usageColor(limit.used, stale, normal) }
      : { value: 0, color: USAGE_COLORS.stale },
  );
}

function resetText(limit: UsageWindow, now: number, text: ClaudeUsageText) {
  if (limit.resetsAt === null) return null;
  const parts = untilReset(limit.resetsAt, now);
  return parts ? text.resetsIn(parts) : text.resettingSoon;
}

export function usageCardLines(
  usage: AgentUsage | null,
  now: number,
  text: ClaudeUsageText,
  remaining = false,
  provider?: UsageProvider,
): HoverCardLine[] {
  const title: HoverCardLine[] = provider ? [{ text: [provider.name, usage?.plan].filter(Boolean).join(" · "), color: provider.color }] : [];
  const noData = provider && provider.id !== "claudeCode" ? text.noUsage[provider.id] : text.noData;
  if (!usage) return [...title, { text: noData, muted: true }];
  const stale = isUsageStale(usage, now);
  const lines: HoverCardLine[] = [];
  const named = usage.models.map((window) => [text.windowNames[window.name] ?? window.name, window] as const);
  for (const [label, limit] of [[text.fiveHour, usage.fiveHour], [text.sevenDay, usage.sevenDay], ...named] as const) {
    if (limit) {
      const percent = Math.round(shownPercent(limit.used, remaining));
      const format = remaining ? text.windowLeft : text.window;
      lines.push({ text: format(label, percent, resetText(limit, now, text)), color: usageColor(limit.used, stale, provider?.color) });
    }
  }
  const hasNumbers = lines.length > 0;
  if (!hasNumbers) lines.push({ text: noData, muted: true });
  lines.push(...usageSourceLines(hasNumbers ? usage : { ...usage, updatedAt: null }, now, text));
  return [...title, ...lines];
}
