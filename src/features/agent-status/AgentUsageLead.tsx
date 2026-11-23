import { useState } from "react";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { useTranslation } from "../../i18n";
import { IslandHoverCard } from "../../components/IslandHoverCard";
import { AgentUsageTable } from "./AgentUsageTable";
import { creditParts, LEVEL_COLOR, peakCell, SourceIcon, UsageMeter, UsageValue, useLineHover, useWindowCells, type UsageToggle } from "./UsageBits";
import { untilReset, usageLevel, USAGE_SOURCE_LABELS, type UsageLine, type UsageView } from "./usage";

export function AgentUsageLead({ lines, now, view, onToggle }: { lines: readonly UsageLine[]; now: number; view: UsageView; onToggle?: UsageToggle }) {
  const text = useTranslation().agent.usage;
  const cellsOf = useWindowCells();
  const hover = useLineHover();
  const [open, setOpen] = useState(false);
  const peaks = lines.flatMap((line) => {
    if (!line.usage) return [];
    const cell = peakCell(cellsOf(line.usage), line.usage);
    return cell ? [{ line, cell }] : [];
  });
  const lead = peaks.reduce<(typeof peaks)[number] | null>((best, entry) => (best === null || entry.cell.window.used > best.cell.window.used ? entry : best), null);
  const rest = lines.filter((line) => line !== lead?.line);
  const reset = lead && view.reset !== "off" ? untilReset(lead.cell.window.resetsAt, now) : null;

  return (
    <div className="agent-usage-lead">
      {lead && (
        <IslandHoverCard lines={hover(lead.line, now)} alignTo=":scope" anchorClassName="agent-usage-lead__hover">
          <div className="agent-usage-lead__main" role="status" aria-label={`${text.of(USAGE_SOURCE_LABELS[lead.line.source])} ${lead.cell.label} ${Math.round(lead.cell.window.used)}%`}>
            <SourceIcon source={lead.line.source} onToggle={onToggle} />
            <span className="agent-usage-lead__name">{text.lead(`${USAGE_SOURCE_LABELS[lead.line.source]} ${lead.cell.label}`)}</span>
            <span className="agent-usage-lead__track" aria-hidden="true">
              <span style={{ width: `${Math.min(100, lead.cell.window.used)}%`, background: LEVEL_COLOR[usageLevel(lead.cell.window.used)] }} />
            </span>
            <UsageValue used={lead.cell.window.used} />
            {reset && <span className="agent-usage__reset"><RotateCcw size={11} strokeWidth={2.2} aria-hidden="true" />{text.resetShort(reset)}</span>}
          </div>
        </IslandHoverCard>
      )}
      <div className="agent-usage-lead__rest">
        {rest.map((line) => {
          const label = text.of(USAGE_SOURCE_LABELS[line.source]);
          const peak = line.usage ? peakCell(cellsOf(line.usage), line.usage) : null;
          const credit = line.credit ? creditParts(line.credit, text) : null;
          return (
            <IslandHoverCard key={line.source} lines={hover(line, now)} alignTo=":scope" anchorClassName="agent-usage-lead__hover">
              <span className="agent-usage-lead__item" role="status" aria-label={peak ? `${label} ${peak.label} ${Math.round(peak.window.used)}%` : `${label} ${credit?.full ?? ""}`}>
                <SourceIcon source={line.source} size={13} onToggle={onToggle} />
                {peak ? <><UsageMeter used={peak.window.used} style="ring" size={13} /><UsageValue used={peak.window.used} /></> : <span>{credit?.value}</span>}
              </span>
            </IslandHoverCard>
          );
        })}
        <button type="button" className="agent-usage__fold agent-usage-lead__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? text.collapse : text.showAll}
          {open ? <ChevronUp size={12} strokeWidth={2.2} aria-hidden="true" /> : <ChevronDown size={12} strokeWidth={2.2} aria-hidden="true" />}
        </button>
      </div>
      {open && (
        <div className="agent-usage-lead__all">
          <AgentUsageTable lines={lines} now={now} view={{ ...view, tightest: false }} onToggle={onToggle} fold={false} />
        </div>
      )}
    </div>
  );
}
