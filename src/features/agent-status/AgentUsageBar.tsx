import { useRef, type CSSProperties } from "react";
import { Clock, RotateCcw } from "lucide-react";
import { useTranslation } from "../../i18n";
import { AgentProviderIcon } from "./AgentProviderIcon";
import type { AgentUsageItem, AgentUsageSource } from "./agentSettings";
import type { AgentUsage } from "./api";
import { IslandHoverCard } from "../../components/IslandHoverCard";
import { MiniRing } from "../../components/MiniRing";
import { availableLines, isStale, tightestWindow, untilReset, usageColumns, usageLevel, usageLines, usageSourceLines, usageWindows, DEFAULT_USAGE_VIEW, USAGE_SOURCE_ICONS, USAGE_SOURCE_LABELS, type AgentUsages, type CreditFigures, type UsageColumns, type UsageView, type UsageWindowCell } from "./usage";
import { useAgentUsages } from "./useAgentUsages";
import { AgentUsageMenu, type UsageViewChange } from "./AgentUsageMenu";
import "./AgentUsageBar.css";

const SINGLE_COLUMN: UsageColumns = { template: "14px auto minmax(0, 1fr) auto", of: () => 2, reset: 3, stale: 4 };

const LEVEL_COLOR = { low: "var(--mint-text, var(--color-agent-idle))", medium: "var(--color-agent-waiting)", high: "var(--color-warning)" } as const;

const CURRENCY: Record<string, string> = { CNY: "¥", RMB: "¥", USD: "$" };

type Toggle = (item: AgentUsageItem) => void;

export function AgentUsageBar({ usages: given, view = DEFAULT_USAGE_VIEW, onViewChange, onToggle }: { usages?: AgentUsages; view?: UsageView; onViewChange?: UsageViewChange; onToggle?: Toggle }) {
  const own = useAgentUsages(given === undefined);
  const box = useRef<HTMLDivElement>(null);
  const usages = given ?? own;
  const lines = usageLines(usages, view);
  if (lines.length === 0) return null;
  const percent = lines.flatMap((line) => (line.usage ? [line.usage] : []));
  const columns: UsageColumns = view.tightest ? SINGLE_COLUMN : usageColumns(percent);
  const sources = availableLines(usages, view.agentsOff).map((line) => line.source);

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
        {lines.map((line) =>
          line.usage ? (
            <UsageLine key={line.source} source={line.source} usage={line.usage} now={usages.readAt} columns={columns} view={view} onToggle={onToggle} />
          ) : (
            <CreditLine key={line.source} source={line.source} credit={line.credit} columns={columns} onToggle={onToggle} />
          ),
        )}
      </div>
      {onViewChange && <AgentUsageMenu view={view} sources={sources} onChange={onViewChange} />}
    </div>
  );
}

function SourceIcon({ source, onToggle }: { source: AgentUsageSource; onToggle?: Toggle }) {
  const t = useTranslation();
  const icon = <AgentProviderIcon provider={USAGE_SOURCE_ICONS[source]} size={14} />;
  if (!onToggle) return icon;
  const label = t.agent.usage.hide(USAGE_SOURCE_LABELS[source]);
  return (
    <button type="button" className="agent-usage__source" title={label} aria-label={label} onClick={() => onToggle(source)}>
      {icon}
    </button>
  );
}

function money(currency: string, total: string): string {
  const symbol = CURRENCY[currency.toUpperCase()];
  return symbol ? `${symbol}${total}` : `${total} ${currency}`;
}

function CreditLine({ source, credit, columns, onToggle }: { source: AgentUsageSource; credit: CreditFigures; columns: UsageColumns; onToggle?: Toggle }) {
  const text = useTranslation().agent.usage;
  const count = (value: number) => value.toLocaleString();
  const figures = credit.kind === "credits" ? text.credits(count(credit.today), count(credit.sevenDay)) : text.balance(money(credit.currency, credit.total));
  return (
    <div className="agent-usage agent-usage--credit" role="status" aria-label={text.of(USAGE_SOURCE_LABELS[source])}>
      <SourceIcon source={source} onToggle={onToggle} />
      <span className="agent-usage__credit" style={{ gridColumn: `2 / ${columns.reset}` }}>{figures}</span>
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

function UsageLine({ source, usage, now, columns, view, onToggle }: { source: AgentUsageSource; usage: AgentUsage; now: number; columns: UsageColumns; view: UsageView; onToggle?: Toggle }) {
  const t = useTranslation();
  const windows = usageWindows(usage, { fiveHour: t.agent.usage.fiveHour, sevenDay: t.agent.usage.sevenDay });
  const tightest = tightestWindow(usage);
  const reset = view.reset === "tightest" && tightest ? untilReset(tightest.resetsAt, now) : null;
  const stale = isStale(usage, now);
  const hoverLines = usageSourceLines(usage, now, t.claudeUsage);
  const staleText = stale ? hoverLines.find((line) => !line.muted)?.text ?? null : null;

  return (
    <IslandHoverCard lines={hoverLines} alignTo=":scope" anchorClassName="agent-usage__hover">
      <div className={`agent-usage${stale ? " agent-usage--stale" : ""}`} role="status" aria-label={t.agent.usage.of(USAGE_SOURCE_LABELS[source])}>
        <SourceIcon source={source} onToggle={onToggle} />
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
