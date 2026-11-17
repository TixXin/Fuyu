import { useEffect, useState } from "react";
import { defineSlot, type IslandCollapsedMeta } from "../../plugin-kernel/slots";
import { ClaudeUsageGauge } from "../ClaudeUsageGauge";
import { CLAUDE_USAGE_GAUGE_WIDTH, USAGE_PROVIDERS, usageHint, usageItemId, type UsageProvider } from "../usageRing";
import { useUsageConfig } from "../useUsageConfig";
import { OWNER } from "./owner.ts";

type GaugeContext = {
  hints: ReadonlySet<string>;
  listenIslandHover: (handler: (inside: boolean) => void) => Promise<() => void>;
};

const gaugeSlot = defineSlot<GaugeContext, IslandCollapsedMeta<GaugeContext>>("island.collapsed/v1");

function UsageGaugeSlot({ provider, listenIslandHover }: { provider: UsageProvider; listenIslandHover: GaugeContext["listenIslandHover"] }) {
  const [hovered, setHovered] = useState(true);
  const [{ show }] = useUsageConfig();
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
  return <ClaudeUsageGauge provider={provider} islandHovered={hovered} showRemaining={show === "remaining"} />;
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
