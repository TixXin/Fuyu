import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../../../i18n";
import { defineSlot, type IslandCollapsedMeta } from "../../plugin-kernel/slots";
import { useBuiltinConfig } from "../../plugin-kernel/useBuiltinPlugins";
import { ClaudeUsageGauge } from "../ClaudeUsageGauge";
import { HoverOnlyUsageGauge } from "../HoverOnlyUsageGauge";
import {
  CLAUDE_USAGE_GAUGE_WIDTH,
  HOVER_ONLY_HINT,
  HOVER_ONLY_ITEM_ID,
  hoverProviderLines,
  shownHoverProviders,
  USAGE_PROVIDERS,
  usageHint,
  usageItemId,
  type UsageProvider,
} from "../usageRing";
import { useHoverUsages } from "../useHoverUsages";
import { useUsageConfig } from "../useUsageConfig";
import { OWNER } from "./owner.ts";

type GaugeContext = {
  hints: ReadonlySet<string>;
  listenIslandHover: (handler: (inside: boolean) => void) => Promise<() => void>;
};

const gaugeSlot = defineSlot<GaugeContext, IslandCollapsedMeta<GaugeContext>>("island.collapsed/v1");

function useHovered(listenIslandHover: GaugeContext["listenIslandHover"]) {
  const [hovered, setHovered] = useState(true);
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    listenIslandHover(setHovered)
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch((error: unknown) => console.error("Failed to listen for island hover", error));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [listenIslandHover]);
  return hovered;
}

function UsageGaugeSlot({ provider, listenIslandHover }: { provider: UsageProvider; listenIslandHover: GaugeContext["listenIslandHover"] }) {
  const t = useTranslation();
  const hovered = useHovered(listenIslandHover);
  const raw = useBuiltinConfig(OWNER);
  const [{ show }] = useUsageConfig();
  const hoverProviders = useMemo(() => shownHoverProviders(raw), [raw]);
  const { items, now, refresh } = useHoverUsages(hoverProviders);
  const extraLines = useMemo(
    () => hoverProviders.flatMap((hp) => hoverProviderLines(items[hp.id], hp, now, t.claudeUsage)),
    [hoverProviders, items, now, t],
  );
  return (
    <ClaudeUsageGauge
      provider={provider}
      islandHovered={hovered}
      showRemaining={show === "remaining"}
      extraLines={extraLines}
      onRefreshExtra={hoverProviders.length > 0 ? refresh : undefined}
    />
  );
}

function HoverOnlyGaugeSlot({ listenIslandHover }: GaugeContext) {
  const hovered = useHovered(listenIslandHover);
  const raw = useBuiltinConfig(OWNER);
  const hoverProviders = useMemo(() => shownHoverProviders(raw), [raw]);
  return <HoverOnlyUsageGauge providers={hoverProviders} islandHovered={hovered} />;
}

function usageGauge(provider: UsageProvider) {
  return function UsageGauge({ listenIslandHover }: GaugeContext) {
    return <UsageGaugeSlot provider={provider} listenIslandHover={listenIslandHover} />;
  };
}

for (const provider of USAGE_PROVIDERS) {
  gaugeSlot.add(
    {
      id: usageItemId(provider),
      order: 70,
      group: "gauges",
      width: CLAUDE_USAGE_GAUGE_WIDTH,
      hideable: true,
      shown: ({ hints }) => hints.has(usageHint(provider)),
      component: usageGauge(provider),
    },
    OWNER,
  );
}

gaugeSlot.add(
  {
    id: HOVER_ONLY_ITEM_ID,
    order: 70,
    group: "gauges",
    width: CLAUDE_USAGE_GAUGE_WIDTH,
    hideable: true,
    shown: ({ hints }) => hints.has(HOVER_ONLY_HINT),
    component: HoverOnlyGaugeSlot,
  },
  OWNER,
);
