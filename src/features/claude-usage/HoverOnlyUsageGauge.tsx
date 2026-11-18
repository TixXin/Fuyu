import { useMemo } from "react";
import { Gauge } from "lucide-react";
import { IslandHoverCard } from "../../components/IslandHoverCard";
import { useTranslation } from "../../i18n";
import { hoverProviderLines, type HoverUsageProvider } from "./usageRing";
import { useHoverUsages } from "./useHoverUsages";
import "./ClaudeUsageGauge.css";

type HoverOnlyUsageGaugeProps = {
  providers: readonly HoverUsageProvider[];
  islandHovered?: boolean;
};

export function HoverOnlyUsageGauge({ providers, islandHovered = true }: HoverOnlyUsageGaugeProps) {
  const t = useTranslation();
  const { items, now, refresh } = useHoverUsages(providers);
  const lines = useMemo(
    () => providers.flatMap((provider) => hoverProviderLines(items[provider.id], provider, now, t.claudeUsage)),
    [providers, items, now, t],
  );
  const label = t.claudeUsage.hoverOnlyLabel(lines.map((line) => line.text).join("; "));

  return (
    <IslandHoverCard lines={lines} suppressed={!islandHovered}>
      <button
        className="claude-usage-gauge"
        type="button"
        data-provider="hover"
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          refresh();
        }}
      >
        <Gauge size={14} strokeWidth={2.1} aria-hidden="true" />
      </button>
    </IslandHoverCard>
  );
}
