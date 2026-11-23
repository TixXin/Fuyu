import { useRef } from "react";
import { AgentUsageChips } from "./AgentUsageChips";
import { AgentUsageLead } from "./AgentUsageLead";
import { AgentUsageRuler } from "./AgentUsageRuler";
import { AgentUsageTable } from "./AgentUsageTable";
import { AgentUsageTiles } from "./AgentUsageTiles";
import type { UsageToggle } from "./UsageBits";
import { availableLines, usageLines, DEFAULT_USAGE_VIEW, type AgentUsages, type UsageLine, type UsageView } from "./usage";
import { useAgentUsages } from "./useAgentUsages";
import { AgentUsageMenu, type UsageViewChange } from "./AgentUsageMenu";
import "./AgentUsageBar.css";
import "./AgentUsageLayouts.css";

type LayoutProps = { lines: readonly UsageLine[]; now: number; view: UsageView; onToggle?: UsageToggle };

function UsageLayout({ lines, now, view, onToggle }: LayoutProps) {
  switch (view.layout ?? "chips") {
    case "tiles":
      return <AgentUsageTiles lines={lines} now={now} view={view} onToggle={onToggle} />;
    case "lead":
      return <AgentUsageLead lines={lines} now={now} view={view} onToggle={onToggle} />;
    case "ruler":
      return <AgentUsageRuler lines={lines} now={now} onToggle={onToggle} />;
    case "table":
      return <AgentUsageTable lines={lines} now={now} view={view} onToggle={onToggle} />;
    default:
      return <AgentUsageChips lines={lines} now={now} view={view} onToggle={onToggle} />;
  }
}

export function AgentUsageBar({ usages: given, view = DEFAULT_USAGE_VIEW, onViewChange, onToggle }: { usages?: AgentUsages; view?: UsageView; onViewChange?: UsageViewChange; onToggle?: UsageToggle }) {
  const own = useAgentUsages(given === undefined);
  const box = useRef<HTMLDivElement>(null);
  const usages = given ?? own;
  const lines = usageLines(usages, view);
  if (lines.length === 0) return null;
  const layout = view.layout ?? "chips";
  const sources = availableLines(usages, view.agentsOff).map((line) => line.source);

  return (
    <div
      ref={box}
      className={`agent-usage-box agent-usage-box--${layout}`}
      data-layout={layout}
      onContextMenu={onViewChange && ((event) => {
        event.preventDefault();
        box.current?.querySelector<HTMLButtonElement>(".agent-usage__menu-button")?.click();
      })}
    >
      <div key={layout} className="agent-usage-layout">
        <UsageLayout lines={lines} now={usages.readAt} view={view} onToggle={onToggle} />
      </div>
      {onViewChange && <AgentUsageMenu view={view} sources={sources} onChange={onViewChange} />}
    </div>
  );
}
