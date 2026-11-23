import { useTranslation } from "../../i18n";
import { IslandHoverCard } from "../../components/IslandHoverCard";
import { creditParts, peakCell, SourceIcon, UsageValue, useLineHover, useWindowCells, type UsageToggle } from "./UsageBits";
import { rulerSpots, USAGE_SOURCE_LABELS, type UsageLine } from "./usage";

const TICKS = [0, 50, 85, 100];

export function AgentUsageRuler({ lines, now, onToggle }: { lines: readonly UsageLine[]; now: number; onToggle?: UsageToggle }) {
  const text = useTranslation().agent.usage;
  const cellsOf = useWindowCells();
  const hover = useLineHover();
  const marks = lines.flatMap((line) => {
    if (!line.usage) return [];
    const cell = peakCell(cellsOf(line.usage), line.usage);
    return cell ? [{ line, cell }] : [];
  });
  const spots = rulerSpots(marks.map(({ cell }) => cell.window.used));
  const credits = lines.filter((line) => line.credit);

  return (
    <div className="agent-usage-ruler">
      {marks.length > 0 && (
        <div className="agent-usage-ruler__scale">
          <span className="agent-usage-ruler__track" aria-hidden="true" />
          {TICKS.map((tick) => (
            <span key={tick} className="agent-usage-ruler__tick" style={{ left: `${tick}%` }} aria-hidden="true">{tick}</span>
          ))}
          {marks.map(({ line, cell }, index) => (
            <IslandHoverCard key={line.source} lines={hover(line, now)} alignTo=".agent-usage-ruler" anchorClassName="agent-usage-ruler__mark">
              <span className="agent-usage-ruler__pin" style={{ left: `${spots[index]}%` }} role="status" aria-label={`${text.of(USAGE_SOURCE_LABELS[line.source])} ${cell.label} ${Math.round(cell.window.used)}%`}>
                <SourceIcon source={line.source} size={12} onToggle={onToggle} />
                <UsageValue used={cell.window.used} />
              </span>
            </IslandHoverCard>
          ))}
        </div>
      )}
      {credits.length > 0 && (
        <div className="agent-usage-ruler__cash">
          {credits.map((line) => {
            const parts = line.credit ? creditParts(line.credit, text) : null;
            return (
              <IslandHoverCard key={line.source} lines={hover(line, now)} alignTo=":scope" anchorClassName="agent-usage-chip__hover">
                <span className="agent-usage-chip" role="status" aria-label={`${text.of(USAGE_SOURCE_LABELS[line.source])} ${parts?.full ?? ""}`}>
                  <SourceIcon source={line.source} onToggle={onToggle} />
                  <strong className="agent-usage-chip__money">{parts?.value}</strong>
                  <span className="agent-usage-chip__label">{parts?.unit}</span>
                </span>
              </IslandHoverCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
