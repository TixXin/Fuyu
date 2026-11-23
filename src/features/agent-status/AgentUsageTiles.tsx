import { RotateCcw } from "lucide-react";
import { useTranslation } from "../../i18n";
import { IslandHoverCard } from "../../components/IslandHoverCard";
import { creditParts, LEVEL_COLOR, peakCell, SourceIcon, useLineHover, useWindowCells, type UsageToggle } from "./UsageBits";
import { isStale, untilReset, usageLevel, USAGE_SOURCE_LABELS, type UsageLine, type UsageView } from "./usage";

export function AgentUsageTiles({ lines, now, view, onToggle }: { lines: readonly UsageLine[]; now: number; view: UsageView; onToggle?: UsageToggle }) {
  const text = useTranslation().agent.usage;
  const cellsOf = useWindowCells();
  const hover = useLineHover();

  return (
    <div className="agent-usage-tiles">
      {lines.map((line) => {
        const name = USAGE_SOURCE_LABELS[line.source];
        if (!line.usage) {
          const parts = creditParts(line.credit, text);
          return (
            <IslandHoverCard key={line.source} lines={hover(line, now)} alignTo=":scope" anchorClassName="agent-usage-tile__hover">
              <div className="agent-usage-tile" role="status" aria-label={`${text.of(name)} ${parts.full}`}>
                <span className="agent-usage-tile__name"><SourceIcon source={line.source} size={12} onToggle={onToggle} /><span>{name}</span></span>
                <span className="agent-usage-tile__big">{parts.value}<small>{parts.unit}</small></span>
                <span className="agent-usage-tile__sub">{parts.detail}</span>
              </div>
            </IslandHoverCard>
          );
        }
        const cells = cellsOf(line.usage);
        const peak = peakCell(cells, line.usage);
        if (!peak) return null;
        const used = Math.round(peak.window.used);
        const level = usageLevel(peak.window.used);
        const reset = view.reset === "off" ? null : untilReset(peak.window.resetsAt, now);
        return (
          <IslandHoverCard key={line.source} lines={hover(line, now)} alignTo=":scope" anchorClassName="agent-usage-tile__hover">
            <div className={`agent-usage-tile${isStale(line.usage, now) ? " agent-usage-tile--stale" : ""}`} role="status" aria-label={`${text.of(name)} ${peak.label} ${used}%`}>
              <span className="agent-usage-tile__name"><SourceIcon source={line.source} size={12} onToggle={onToggle} /><span>{name}</span></span>
              <span className={`agent-usage-tile__big agent-usage__value--${level}`}>{used}%<small>{peak.label}</small></span>
              <span className="agent-usage-tile__sub">
                {reset && <><RotateCcw size={10} strokeWidth={2.2} aria-hidden="true" />{text.resetShort(reset)}</>}
                {cells.length > 1 && <span className="agent-usage-tile__more" title={text.moreWindows(cells.length - 1)}>+{cells.length - 1}</span>}
              </span>
              <span className="agent-usage-tile__meter" aria-hidden="true"><span style={{ width: `${Math.min(100, used)}%`, background: LEVEL_COLOR[level] }} /></span>
            </div>
          </IslandHoverCard>
        );
      })}
    </div>
  );
}
