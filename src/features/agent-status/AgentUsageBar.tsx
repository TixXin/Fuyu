import { useRef, type CSSProperties } from "react";
import { Clock, RotateCcw } from "lucide-react";
import { useTranslation } from "../../i18n";
import { AgentProviderIcon } from "./AgentProviderIcon";
import type { AgentProvider, AgentUsage } from "./api";
import { IslandHoverCard } from "../../components/IslandHoverCard";
import { MiniRing } from "../../components/MiniRing";
import { hasUsageNumbers, isStale, liveUsage, shownUsage, tightestWindow, untilReset, usageColumns, usageLevel, usageSourceLines, usageWindows, DEFAULT_USAGE_VIEW, type AgentUsages, type UsageColumns, type UsageView, type UsageWindowCell } from "./usage";
import { useAgentUsages } from "./useAgentUsages";
import { AgentUsageMenu, type UsageViewChange } from "./AgentUsageMenu";
import "./AgentUsageBar.css";

const SINGLE_COLUMN: UsageColumns = { template: "14px auto minmax(0, 1fr) auto", of: () => 2, reset: 3, stale: 4 };

const LEVEL_COLOR = { low: "var(--mint-text, var(--color-agent-idle))", medium: "var(--color-agent-waiting)", high: "var(--color-warning)" } as const;

export function usageLines(usages: AgentUsages, view: UsageView): [AgentProvider, AgentUsage][] {
  const lines: [AgentProvider, AgentUsage][] = [];
  const claude = usages.claude && liveUsage(usages.claude, usages.readAt);
  const codex = usages.codex && liveUsage(usages.codex, usages.readAt);
  if (claude && !view.hidden.includes("claudeCode")) lines.push(["claudeCode", shownUsage(claude, view)]);
  if (codex && !view.hidden.includes("codex")) lines.push(["codex", shownUsage(codex, view)]);
  return lines.filter(([, usage]) => hasUsageNumbers(usage));
}

export function AgentUsageBar({ usages: given, view = DEFAULT_USAGE_VIEW, onViewChange }: { usages?: AgentUsages; view?: UsageView; onViewChange?: UsageViewChange }) {
  const own = useAgentUsages(given === undefined);
  const box = useRef<HTMLDivElement>(null);
  const usages = given ?? own;
  const lines = usageLines(usages, view);
  if (lines.length === 0) return null;
  const columns: UsageColumns = view.tightest ? SINGLE_COLUMN : usageColumns(lines.map(([, usage]) => usage));

  return (
    <div
      ref={box}
      className="agent-usage-box"
      onContextMenu={onViewChange && ((event) => {
        event.preventDefault();
        box.current?.querySelector<HTMLButtonElement>(".agent-usage__menu-button")?.click();
      })}
    >
      <div className={`agent-usage-table agent-usage-table--${view.style}`} style={{ "--agent-usage-columns": columns.template } as CSSProperties}>
        {lines.map(([provider, usage]) => (
          <UsageLine key={provider} provider={provider} usage={usage} now={usages.readAt} columns={columns} view={view} />
        ))}
      </div>
      {onViewChange && <AgentUsageMenu view={view} onChange={onViewChange} />}
    </div>
  );
}

function UsageCell({ cell, view, now }: { cell: UsageWindowCell; view: UsageView; now: number }) {
  const t = useTranslation();
  const level = usageLevel(cell.window.used);
  const used = Math.round(cell.window.used);
  const reset = view.reset === "each" ? untilReset(cell.window.resetsAt, now) : null;
  return (
    <>
      {view.style === "ring" && <MiniRing rings={[{ value: Math.min(100, used) / 100, color: LEVEL_COLOR[level] }]} size={14} strokeWidth={2.4} ariaLabel={`${cell.label} ${used}%`} />}
      <span className="agent-usage__label">{cell.label}</span>
      {view.style === "bar" && (
        <span className="agent-usage__bar" aria-hidden="true">
          <span style={{ width: `${Math.min(100, used)}%`, background: LEVEL_COLOR[level] }} />
        </span>
      )}
      <strong className={`agent-usage__value agent-usage__value--${level}`}>{used}%</strong>
      {reset && <span className="agent-usage__window-reset" aria-label={t.agent.usage.resetsIn(reset)}>{t.agent.usage.resetShort(reset)}</span>}
    </>
  );
}

function UsageLine({ provider, usage, now, columns, view }: { provider: AgentProvider; usage: AgentUsage; now: number; columns: UsageColumns; view: UsageView }) {
  const t = useTranslation();
  const windows = usageWindows(usage, { fiveHour: t.agent.usage.fiveHour, sevenDay: t.agent.usage.sevenDay });
  const tightest = tightestWindow(usage);
  const reset = view.reset === "tightest" && tightest ? untilReset(tightest.resetsAt, now) : null;
  const stale = isStale(usage, now);
  const hoverLines = usageSourceLines(usage, now, t.claudeUsage);
  const staleText = stale ? hoverLines.find((line) => !line.muted)?.text ?? null : null;

  return (
    <IslandHoverCard lines={hoverLines} alignTo=":scope" anchorClassName="agent-usage__hover">
      <div className={`agent-usage${stale ? " agent-usage--stale" : ""}`} role="status" aria-label={provider === "codex" ? t.agent.usage.codexLabel : t.agent.usage.label}>
        <AgentProviderIcon provider={provider} size={14} />
        {windows.map((cell) => (
          <span key={cell.key} className="agent-usage__window" style={{ gridColumn: columns.of(cell.key) }}>
            <UsageCell cell={cell} view={view} now={now} />
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
