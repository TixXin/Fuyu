import { useTranslation } from "../../i18n";
import { IslandHoverCard } from "../../components/IslandHoverCard";
import { creditParts, peakCell, SourceIcon, UsageMeter, UsageValue, useLineHover, useWindowCells, type UsageToggle } from "./UsageBits";
import { isStale, USAGE_SOURCE_LABELS, type UsageLine, type UsageView } from "./usage";

export function AgentUsageChips({ lines, now, view, onToggle }: { lines: readonly UsageLine[]; now: number; view: UsageView; onToggle?: UsageToggle }) {
  const text = useTranslation().agent.usage;
  const cellsOf = useWindowCells();
  const hover = useLineHover();

  return (
    <div className={`agent-usage-chips agent-usage-chips--${view.style}`}>
      {lines.map((line) => {
        const label = text.of(USAGE_SOURCE_LABELS[line.source]);
        if (!line.usage) {
          const parts = creditParts(line.credit, text);
          return (
            <IslandHoverCard key={line.source} lines={hover(line, now)} alignTo=":scope" anchorClassName="agent-usage-chip__hover">
              <span className="agent-usage-chip" role="status" aria-label={`${label} ${parts.full}`}>
                <SourceIcon source={line.source} onToggle={onToggle} />
                <strong className="agent-usage-chip__money">{parts.value}</strong>
                <span className="agent-usage-chip__label">{parts.unit}</span>
              </span>
            </IslandHoverCard>
          );
        }
        const cells = cellsOf(line.usage);
        const peak = peakCell(cells, line.usage);
        if (!peak) return null;
        const stale = isStale(line.usage, now);
        return (
          <IslandHoverCard key={line.source} lines={hover(line, now)} alignTo=":scope" anchorClassName="agent-usage-chip__hover">
            <span className={`agent-usage-chip${stale ? " agent-usage-chip--stale" : ""}`} role="status" aria-label={`${label} ${peak.label} ${Math.round(peak.window.used)}%`}>
              <SourceIcon source={line.source} onToggle={onToggle} />
              <UsageMeter used={peak.window.used} style={view.style} />
              <UsageValue used={peak.window.used} />
              <span className="agent-usage-chip__label">{peak.label}</span>
              {cells.length > 1 && <span className="agent-usage-chip__more" aria-hidden="true">+{cells.length - 1}</span>}
              {stale && <span className="agent-usage-chip__stale" role="img" aria-label={text.stale} />}
            </span>
          </IslandHoverCard>
        );
      })}
    </div>
  );
}
