import type { AgentUsage, UsageWindow } from "./types";
import type { HoverCardLine } from "../../components/IslandHoverCard";
import type { ClaudeUsageText } from "../../i18n/sections/claudeUsage";
import { formatAge } from "../../components/list/formatAgo.ts";

export const USAGE_STALE_MS = 15 * 60_000;

export function untilReset(resetsAt: number | null, now: number) {
  if (resetsAt === null || resetsAt <= now) return null;
  const minutes = Math.ceil((resetsAt - now) / 60_000);
  return { days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60), minutes: minutes % 60 };
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
  if (usage.error) {
    const table =
      usage.source === "glm" || usage.source === "kimi"
        ? text.planErrors
        : usage.source === "antigravity" || usage.source === "antigravityCloud"
          ? text.antigravityErrors
          : text.errors;
    lines.push({ text: table[usage.error.kind] });
  }
  if (usage.updatedAt !== null) {
    const kind = usage.source ?? "hud";
    const source = {
      api: text.fromApi,
      magpie: text.fromMagpie,
      codex: text.fromCodex,
      hud: text.fromHud,
      glm: text.fromGlm,
      kimi: text.fromKimi,
      antigravity: text.fromAntigravity,
      antigravityCloud: text.fromAntigravityCloud,
    }[kind];
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
