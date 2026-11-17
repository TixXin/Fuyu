import { useMemo } from "react";
import { IslandHoverCard } from "../../components/IslandHoverCard";
import { MiniRing } from "../../components/MiniRing";
import { useTranslation } from "../../i18n";
import { CLAUDE_USAGE_RING_SIZE, USAGE_PROVIDERS, usageCardLines, usageRings, type UsageProvider } from "./usageRing";
import { useClaudeUsage } from "./useClaudeUsage";
import "./ClaudeUsageGauge.css";

type ClaudeUsageGaugeProps = {
  provider?: UsageProvider;
  islandHovered?: boolean;
  showRemaining?: boolean;
};

export function ClaudeUsageGauge({ provider = USAGE_PROVIDERS[0], islandHovered = true, showRemaining = false }: ClaudeUsageGaugeProps) {
  const t = useTranslation();
  const { usage, agentsOff, now, refresh } = useClaudeUsage(provider.id);
  const rings = useMemo(() => usageRings(usage, now, showRemaining, provider.color), [usage, now, showRemaining, provider]);
  const lines = useMemo(() => {
    const card = usageCardLines(usage, now, t.claudeUsage, showRemaining, provider);
    return agentsOff ? [card[0], { text: t.claudeUsage.needsAgents, muted: true }] : card;
  }, [usage, agentsOff, now, t, showRemaining, provider]);
  const label = t.claudeUsage.ringLabel(lines.map((line) => line.text).join("; "));

  return (
    <IslandHoverCard lines={lines} suppressed={!islandHovered}>
      <button
        className="claude-usage-gauge"
        type="button"
        data-provider={provider.id}
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          refresh();
        }}
      >
        <MiniRing rings={rings} size={CLAUDE_USAGE_RING_SIZE} ariaLabel={label} />
      </button>
    </IslandHoverCard>
  );
}
