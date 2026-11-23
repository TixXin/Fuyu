import { useTranslation } from "../../i18n";
import { IslandHoverCard } from "../../components/IslandHoverCard";
import { formatAge } from "../../components/list/formatAgo.ts";
import { SourceIcon, type UsageToggle } from "./UsageBits";
import { USAGE_SOURCE_LABELS, type ExpiredLine } from "./usage";

export function AgentUsageExpired({ lines, now, onToggle }: { lines: readonly ExpiredLine[]; now: number; onToggle?: UsageToggle }) {
  const t = useTranslation();
  const text = t.agent.usage;
  const sources = t.claudeUsage;
  return (
    <div className="agent-usage-expired">
      {lines.map(({ source, usage, updatedAt }) => {
        const ago = formatAge(Math.max(0, now - updatedAt), sources.ago);
        const from = usage.source === "statusline" ? sources.fromStatusline : usage.source === "api" ? sources.fromApi : usage.source === "codex" ? sources.fromCodex : sources.fromHud;
        const hover = [{ text: USAGE_SOURCE_LABELS[source] }, { text: text.expiredDetail(ago, from) }, ...(source === "claudeCode" ? [{ text: text.expiredFix, muted: true }] : [])];
        return (
          <IslandHoverCard key={source} lines={hover} alignTo=":scope" anchorClassName="agent-usage-chip__hover">
            <span className="agent-usage-chip agent-usage-chip--expired" role="status" aria-label={`${text.of(USAGE_SOURCE_LABELS[source])} ${text.expired(ago)}`}>
              <SourceIcon source={source} onToggle={onToggle} />
              <span className="agent-usage-chip__label">{text.expired(ago)}</span>
            </span>
          </IslandHoverCard>
        );
      })}
    </div>
  );
}
