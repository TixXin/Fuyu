import { useTranslation } from "../../i18n";
import { IslandHoverCard } from "../../components/IslandHoverCard";
import { creditParts, LEVEL_COLOR, peakCell, SourceIcon, UsageValue, useLineHover, useWindowCells, type UsageToggle } from "./UsageBits";
import { isStale, usageLevel, USAGE_SOURCE_LABELS, type UsageLine } from "./usage";
import "./AgentUsageStrip.css";

export function AgentUsageStrip({ lines, now, onToggle }: { lines: readonly UsageLine[]; now: number; onToggle?: UsageToggle }) {
  const text = useTranslation().agent.usage;
  const cellsOf = useWindowCells();
  const hover = useLineHover();

  return (
    <div className="agent-usage-strip">
      {lines.map((line) => {
        const label = text.of(USAGE_SOURCE_LABELS[line.source]);
        if (!line.usage) {
          const parts = creditParts(line.credit, text);
          return (
            <IslandHoverCard key={line.source} lines={hover(line, now)} alignTo=":scope" anchorClassName="agent-usage-strip__hover">
              <span className="agent-usage-strip__item" role="status" aria-label={`${label} ${parts.full}`}>
                <SourceIcon source={line.source} size={13} onToggle={onToggle} />
                <strong className="agent-usage-chip__money">{parts.value}</strong>
                <span className="agent-usage-strip__unit">{parts.unit}</span>
              </span>
            </IslandHoverCard>
          );
        }
        const cells = cellsOf(line.usage);
        const peak = peakCell(cells, line.usage);
        if (!peak) return null;
        const stale = isStale(line.usage, now);
        const level = usageLevel(peak.window.used);
        return (
          <IslandHoverCard key={line.source} lines={hover(line, now)} alignTo=":scope" anchorClassName="agent-usage-strip__hover">
            <span className={`agent-usage-strip__item${stale ? " agent-usage-strip__item--stale" : ""}`} role="status" aria-label={`${label} ${peak.label} ${Math.round(peak.window.used)}%`}>
              <SourceIcon source={line.source} size={13} onToggle={onToggle} />
              <UsageValue used={peak.window.used} />
              <span className="agent-usage-strip__unit">{peak.label}</span>
              <span className="agent-usage-strip__line" style={{ background: LEVEL_COLOR[level] }} aria-hidden="true" />
              {stale && <span className="agent-usage-strip__stale" role="img" aria-label={text.stale} />}
            </span>
          </IslandHoverCard>
        );
      })}
    </div>
  );
}
