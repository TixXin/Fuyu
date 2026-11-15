import type { CSSProperties } from "react";
import { Clock, RotateCcw } from "lucide-react";
import { useTranslation } from "../../i18n";
import { AgentProviderIcon } from "./AgentProviderIcon";
import type { AgentProvider, AgentUsage } from "./api";
import { IslandHoverCard } from "../../components/IslandHoverCard";
import { hasUsageNumbers, isStale, liveUsage, tightestWindow, untilReset, usageColumns, usageLevel, usageSourceLines, usageWindows, type AgentUsages, type UsageColumns } from "./usage";
import { useAgentUsages } from "./useAgentUsages";
import "./AgentUsageBar.css";

export function AgentUsageBar({ usages: given }: { usages?: AgentUsages }) {
  const own = useAgentUsages(given === undefined);
  const usages = given ?? own;
  const lines: [AgentProvider, AgentUsage][] = [];
  const claude = usages.claude && liveUsage(usages.claude, usages.readAt);
  const codex = usages.codex && liveUsage(usages.codex, usages.readAt);
  if (claude && hasUsageNumbers(claude)) lines.push(["claudeCode", claude]);
  if (codex && hasUsageNumbers(codex)) lines.push(["codex", codex]);
  if (lines.length === 0) return null;
  const columns = usageColumns(lines.map(([, usage]) => usage));

  return (
    <div className="agent-usage-table" style={{ "--agent-usage-columns": columns.template } as CSSProperties}>
      {lines.map(([provider, usage]) => (
        <UsageLine key={provider} provider={provider} usage={usage} now={usages.readAt} columns={columns} />
      ))}
    </div>
  );
}

function UsageLine({ provider, usage, now, columns }: { provider: AgentProvider; usage: AgentUsage; now: number; columns: UsageColumns }) {
  const t = useTranslation();
  const windows = usageWindows(usage, { fiveHour: t.agent.usage.fiveHour, sevenDay: t.agent.usage.sevenDay });
  const tightest = tightestWindow(usage);
  const reset = tightest ? untilReset(tightest.resetsAt, now) : null;
  const stale = isStale(usage, now);
  const hoverLines = usageSourceLines(usage, now, t.claudeUsage);
  const staleText = stale ? hoverLines.find((line) => !line.muted)?.text ?? null : null;

  return (
    <IslandHoverCard lines={hoverLines} alignTo=":scope" anchorClassName="agent-usage__hover">
      <div className={`agent-usage${stale ? " agent-usage--stale" : ""}`} role="status" aria-label={provider === "codex" ? t.agent.usage.codexLabel : t.agent.usage.label}>
        <AgentProviderIcon provider={provider} size={14} />
        {windows.map(({ key, label, window }) => (
          <span key={key} className="agent-usage__window" style={{ gridColumn: columns.of(key) }}>
            <span className="agent-usage__label">{label}</span>
            <strong className={`agent-usage__value agent-usage__value--${usageLevel(window.used)}`}>{Math.round(window.used)}%</strong>
          </span>
        ))}
        {reset && (
          <span className="agent-usage__reset" style={{ gridColumn: columns.reset }} aria-label={t.agent.usage.resetsIn(reset)}>
            <RotateCcw size={11} strokeWidth={2.2} aria-hidden="true" />
            {t.agent.usage.resetShort(reset)}
          </span>
        )}
        {staleText && (
          <span className="agent-usage__stale" style={{ gridColumn: columns.stale }} role="img" aria-label={staleText}>
            <Clock size={12} strokeWidth={2.2} aria-hidden="true" />
          </span>
        )}
      </div>
    </IslandHoverCard>
  );
}
