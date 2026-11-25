import { useTranslation } from "../../i18n";
import type { ClaudeUsageText } from "../../i18n/sections/claudeUsage";
import { IslandHoverCard } from "../../components/IslandHoverCard";
import { formatAge } from "../../components/list/formatAgo.ts";
import { Fragment } from "react";
import { AgentUsageFix } from "./AgentUsageFix";
import { SourceIcon, type UsageToggle } from "./UsageBits";
import { USAGE_SOURCE_LABELS, type ExpiredLine } from "./usage";
import type { AgentUsage } from "./api";
import type { AgentUsageSource } from "./agentSettings";

function sourceLabel(usage: AgentUsage, sources: ClaudeUsageText): string {
  switch (usage.source) {
    case "statusline":
      return sources.fromStatusline;
    case "api":
      return sources.fromApi;
    case "codex":
      return sources.fromCodex;
    case "antigravity":
      return sources.fromAntigravity;
    case "antigravityCloud":
      return sources.fromAntigravityCloud;
    case "cursor":
      return sources.fromCursor;
    case "glm":
      return sources.fromGlm;
    case "kimi":
      return sources.fromKimi;
    default:
      return sources.fromHud;
  }
}

function errorText(source: AgentUsageSource, usage: AgentUsage, sources: ClaudeUsageText): string | null {
  if (!usage.error) return null;
  if (source === "claudeCode") return sources.errors[usage.error.kind];
  if (source === "antigravity") return sources.antigravityErrors[usage.error.kind];
  if (source === "cursor") return sources.cursorErrors[usage.error.kind];
  return null;
}

export function AgentUsageExpired({ lines, now, onToggle }: { lines: readonly ExpiredLine[]; now: number; onToggle?: UsageToggle }) {
  const t = useTranslation();
  const text = t.agent.usage;
  const sources = t.claudeUsage;
  return (
    <div className="agent-usage-expired">
      {lines.map(({ source, usage, updatedAt }) => {
        const failure = errorText(source, usage, sources);
        const failureLines = failure ? [{ text: failure }] : [];
        const expiredAuth = usage.error?.kind === "tokenExpired" || usage.error?.kind === "loginRequired";
        const ago = updatedAt !== null ? formatAge(Math.max(0, now - updatedAt), sources.ago) : null;
        const label = ago !== null ? text.expired(ago) : expiredAuth ? text.expiredShort : text.unavailable;
        const detail = ago !== null ? [{ text: text.expiredDetail(ago, sourceLabel(usage, sources)) }] : [];
        const hover = [{ text: USAGE_SOURCE_LABELS[source] }, ...detail, ...failureLines, ...(source === "claudeCode" ? [{ text: text.expiredFix, muted: true }] : [])];
        return (
          <Fragment key={source}>
            <IslandHoverCard lines={hover} alignTo=":scope" anchorClassName="agent-usage-chip__hover">
              <span className="agent-usage-chip agent-usage-chip--expired" role="status" aria-label={`${text.of(USAGE_SOURCE_LABELS[source])} ${label}`}>
                <SourceIcon source={source} onToggle={onToggle} />
                <span className="agent-usage-chip__label">{label}</span>
              </span>
            </IslandHoverCard>
            {source === "claudeCode" && <AgentUsageFix />}
          </Fragment>
        );
      })}
    </div>
  );
}
