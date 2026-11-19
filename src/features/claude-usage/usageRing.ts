import type { AgentUsage, UsageWindow } from "../../lib/agent-usage/types";
import { liveUsage, untilReset, USAGE_STALE_MS, usageSourceLines } from "../../lib/agent-usage/usage.ts";
import { formatAge } from "../../components/list/formatAgo.ts";
import type { HoverCardLine } from "../../components/IslandHoverCard";
import type { MiniRingTrack } from "../../components/MiniRing";
import type { ClaudeUsageText } from "../../i18n/sections/claudeUsage";
import type { HoverProviderId, HoverUsage } from "./api";

export type { HoverProviderId };

export const CLAUDE_USAGE_RING_SIZE = 24;
export const CLAUDE_USAGE_GAUGE_WIDTH = CLAUDE_USAGE_RING_SIZE + 6;
export const HOVER_ONLY_ITEM_ID = "usage:hover";
export const HOVER_ONLY_HINT = "usage.hover";

export const USAGE_COLORS = {
  normal: "var(--usage-claude)",
  warn: "var(--usage-warn)",
  danger: "var(--usage-danger)",
  stale: "var(--usage-stale)",
} as const;

export type UsageProviderId = "claudeCode" | "codex" | "antigravity" | "glm" | "kimi" | "cursor";
export type AllUsageProviderId = UsageProviderId | HoverProviderId;

export const USAGE_PROVIDERS: readonly { id: UsageProviderId; name: string; color: string; defaultOn: boolean }[] = [
  { id: "claudeCode", name: "Claude Code", color: USAGE_COLORS.normal, defaultOn: true },
  { id: "codex", name: "Codex", color: "var(--usage-codex)", defaultOn: false },
  { id: "antigravity", name: "Antigravity", color: "var(--usage-antigravity)", defaultOn: false },
  { id: "glm", name: "GLM", color: "var(--usage-glm)", defaultOn: false },
  { id: "kimi", name: "Kimi", color: "var(--usage-kimi)", defaultOn: false },
  { id: "cursor", name: "Cursor", color: "var(--usage-cursor)", defaultOn: false },
];

export const HIDDEN_WITHOUT_NUMBERS: ReadonlySet<UsageProviderId> = new Set(["cursor"]);

export function hasUsageNumbers(usage: AgentUsage | null) {
  return Boolean(usage && (usage.fiveHour || usage.sevenDay || usage.models.length > 0));
}

export const HOVER_USAGE_PROVIDERS: readonly { id: HoverProviderId; name: string; color: string; defaultOn: boolean }[] = [
  { id: "workbuddy", name: "WorkBuddy", color: "var(--usage-workbuddy)", defaultOn: false },
  { id: "dsh", name: "DeepSeek Harness", color: "var(--usage-dsh)", defaultOn: false },
];

export type UsageProvider = (typeof USAGE_PROVIDERS)[number];
export type HoverUsageProvider = (typeof HOVER_USAGE_PROVIDERS)[number];

export const usageItemId = (provider: Pick<UsageProvider, "id">) => `usage:${provider.id}`;

export const usageHint = (provider: Pick<UsageProvider, "id">) => `usage.${provider.id}`;

export function shownUsageProviders(settings: Record<string, unknown>): UsageProvider[] {
  return USAGE_PROVIDERS.filter(({ id, defaultOn }) => (typeof settings[id] === "boolean" ? settings[id] : defaultOn));
}

export function shownHoverProviders(settings: Record<string, unknown>): HoverUsageProvider[] {
  return HOVER_USAGE_PROVIDERS.filter(({ id, defaultOn }) => (typeof settings[id] === "boolean" ? settings[id] : defaultOn));
}

export function needsHoverOnlyGauge(settings: Record<string, unknown>): boolean {
  return shownUsageProviders(settings).length === 0 && shownHoverProviders(settings).length > 0;
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

export function usageRings(given: AgentUsage | null, now: number, remaining = false, normal: string = USAGE_COLORS.normal): MiniRingTrack[] {
  const usage = given && liveUsage(given, now);
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
  given: AgentUsage | null,
  now: number,
  text: ClaudeUsageText,
  remaining = false,
  provider?: UsageProvider,
): HoverCardLine[] {
  const title: HoverCardLine[] = provider ? [{ text: [provider.name, given?.plan].filter(Boolean).join(" · "), color: provider.color }] : [];
  const noData = provider && provider.id !== "claudeCode" ? text.noUsage[provider.id] : text.noData;
  if (!given) return [...title, { text: noData, muted: true }];
  const usage = liveUsage(given, now);
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
  const hadNumbers = Boolean(given.fiveHour || given.sevenDay || given.models.length > 0);
  lines.push(...usageSourceLines(hadNumbers ? usage : { ...usage, updatedAt: null }, now, text));
  return [...title, ...lines];
}

export function hoverProviderLines(
  item: HoverUsage | null | undefined,
  provider: HoverUsageProvider,
  now: number,
  text: ClaudeUsageText,
): HoverCardLine[] {
  const lines: HoverCardLine[] = [{ text: provider.name, color: provider.color }];
  if (!item) {
    lines.push({ text: text.noUsage[provider.id], muted: true });
    return lines;
  }
  if (provider.id === "workbuddy") {
    if (item.credits) {
      lines.push({
        text: text.workbuddyCredits(item.credits.today, item.credits.sevenDay, item.credits.total, item.credits.totalTokens),
      });
      if (item.updatedAt !== null) {
        const ago = formatAge(Math.max(0, now - item.updatedAt), text.ago);
        lines.push({ text: text.updated(ago, text.fromWorkbuddy), muted: true });
      }
    } else if (item.error) {
      lines.push({ text: text.workbuddyErrors[item.error.kind] });
    } else {
      lines.push({ text: text.noUsage.workbuddy, muted: true });
    }
    return lines;
  }

  if (item.wallets.length > 0) {
    const depleted = item.available === false;
    for (const wallet of item.wallets) {
      lines.push({
        text: text.dshWallet(wallet.currency, wallet.total, wallet.toppedUp, wallet.granted),
        color: depleted ? USAGE_COLORS.danger : undefined,
      });
    }
    if (depleted) {
      lines.push({ text: text.dshEmpty, color: USAGE_COLORS.danger });
    }
    if (item.error) {
      lines.push({ text: text.dshErrors[item.error.kind] });
    }
    if (item.updatedAt !== null) {
      const ago = formatAge(Math.max(0, now - item.updatedAt), text.ago);
      const source = item.source === "dshAccount" ? text.fromDshAccount : text.fromDshApi;
      const stale = now - item.updatedAt > USAGE_STALE_MS;
      lines.push({ text: stale ? text.staleUpdated(ago, source) : text.updated(ago, source), muted: !stale });
    }
  } else if (item.error) {
    lines.push({ text: text.dshErrors[item.error.kind] });
  } else {
    lines.push({ text: text.noUsage.dsh, muted: true });
  }
  return lines;
}
