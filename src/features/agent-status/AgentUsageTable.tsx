import { useState, type CSSProperties } from "react";
import { ChevronDown, ChevronUp, Clock, RotateCcw } from "lucide-react";
import { useTranslation } from "../../i18n";
import { IslandHoverCard } from "../../components/IslandHoverCard";
import type { AgentUsage } from "./api";
import type { AgentUsageSource } from "./agentSettings";
import { creditParts, SourceIcon, UsageMeter, UsageValue, useLineHover, useWindowCells, type UsageToggle } from "./UsageBits";
import { isStale, tightestWindow, untilReset, usageColumns, usageSourceLines, USAGE_SOURCE_LABELS, type CreditFigures, type UsageColumns, type UsageLine, type UsageView, type UsageWindowCell } from "./usage";

const SINGLE_COLUMN: UsageColumns = { template: "14px auto minmax(0, 1fr) auto", of: () => 2, reset: 3, stale: 4 };
const FOLD_AFTER = 3;

type TableProps = { lines: readonly UsageLine[]; now: number; view: UsageView; onToggle?: UsageToggle; fold?: boolean };

export function AgentUsageTable({ lines, now, view, onToggle, fold = true }: TableProps) {
  const text = useTranslation().agent.usage;
  const [open, setOpen] = useState(false);
  const folds = fold && lines.length > FOLD_AFTER + 1;
  const shown = folds && !open ? lines.slice(0, FOLD_AFTER) : lines;
  const percent = lines.flatMap((line) => (line.usage ? [line.usage] : []));
  const columns: UsageColumns = view.tightest ? SINGLE_COLUMN : usageColumns(percent);

  return (
    <div className={`agent-usage-table agent-usage-table--${view.style}`} style={{ "--agent-usage-columns": columns.template } as CSSProperties}>
      {shown.map((line, index) => (
        <div key={line.source} className={index >= FOLD_AFTER ? "agent-usage__more agent-usage__row-wrap" : "agent-usage__row-wrap"}>
          {line.usage ? (
            <UsageRow line={line} source={line.source} usage={line.usage} now={now} columns={columns} view={view} onToggle={onToggle} />
          ) : (
            <CreditRow line={line} source={line.source} credit={line.credit} now={now} columns={columns} onToggle={onToggle} />
          )}
        </div>
      ))}
      {folds && (
        <button type="button" className="agent-usage__fold" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? text.collapse : text.moreSources(lines.length - FOLD_AFTER)}
          {open ? <ChevronUp size={12} strokeWidth={2.2} aria-hidden="true" /> : <ChevronDown size={12} strokeWidth={2.2} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}

function CreditRow({ line, source, credit, now, columns, onToggle }: { line: UsageLine; source: AgentUsageSource; credit: CreditFigures; now: number; columns: UsageColumns; onToggle?: UsageToggle }) {
  const text = useTranslation().agent.usage;
  const hover = useLineHover();
  return (
    <IslandHoverCard lines={hover(line, now)} alignTo=":scope" anchorClassName="agent-usage__hover">
      <div className="agent-usage agent-usage--credit" role="status" aria-label={text.of(USAGE_SOURCE_LABELS[source])}>
        <SourceIcon source={source} onToggle={onToggle} />
        <span className="agent-usage__credit" style={{ gridColumn: `2 / ${columns.reset}` }}>{creditParts(credit, text).full}</span>
      </div>
    </IslandHoverCard>
  );
}

function UsageCell({ cell, view, now }: { cell: UsageWindowCell; view: UsageView; now: number }) {
  const text = useTranslation().agent.usage;
  const reset = view.reset === "each" ? untilReset(cell.window.resetsAt, now) : null;
  return (
    <>
      {view.style === "ring" && <UsageMeter used={cell.window.used} style="ring" />}
      <span className="agent-usage__label">{cell.label}</span>
      {view.style === "bar" && <UsageMeter used={cell.window.used} style="bar" />}
      <UsageValue used={cell.window.used} />
      {reset && <span className="agent-usage__window-reset" aria-label={text.resetsIn(reset)}>{text.resetShort(reset)}</span>}
    </>
  );
}

function UsageRow({ line, source, usage, now, columns, view, onToggle }: { line: UsageLine; source: AgentUsageSource; usage: AgentUsage; now: number; columns: UsageColumns; view: UsageView; onToggle?: UsageToggle }) {
  const text = useTranslation().agent.usage;
  const cellsOf = useWindowCells();
  const hover = useLineHover();
  const tightest = tightestWindow(usage);
  const reset = view.reset === "tightest" && tightest ? untilReset(tightest.resetsAt, now) : null;
  const t = useTranslation();
  const stale = isStale(usage, now);
  const staleText = stale ? usageSourceLines(usage, now, t.claudeUsage).find((entry) => !entry.muted)?.text ?? text.stale : null;

  return (
    <IslandHoverCard lines={hover(line, now)} alignTo=":scope" anchorClassName="agent-usage__hover">
      <div className={`agent-usage${stale ? " agent-usage--stale" : ""}`} role="status" aria-label={text.of(USAGE_SOURCE_LABELS[source])}>
        <SourceIcon source={source} onToggle={onToggle} />
        {cellsOf(usage).map((cell) => (
          <span key={cell.key} className="agent-usage__window" style={{ gridColumn: columns.of(cell.key) }}>
            <UsageCell cell={cell} view={view} now={now} />
          </span>
        ))}
        {reset && (
          <span className="agent-usage__reset" style={{ gridColumn: columns.reset }} aria-label={text.resetsIn(reset)}>
            <RotateCcw size={11} strokeWidth={2.2} aria-hidden="true" />
            {text.resetShort(reset)}
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
