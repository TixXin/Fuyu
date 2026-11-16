import { useEffect, useState } from "react";
import { defineSlot, type IslandCollapsedMeta } from "../../plugin-kernel/slots";
import { ClaudeUsageGauge } from "../ClaudeUsageGauge";
import { CLAUDE_USAGE_GAUGE_WIDTH, USAGE_PROVIDERS, shownUsageProviders, usageItemId, type UsageProvider } from "../usageRing";

type GaugeContext = {
  usage: { enabled: boolean; settings: Record<string, unknown>; showRemaining: boolean };
  listenIslandHover: (handler: (inside: boolean) => void) => Promise<() => void>;
};

const gaugeSlot = defineSlot<GaugeContext, IslandCollapsedMeta<GaugeContext>>("island.collapsed/v1");

function UsageGaugeSlot({ providers, showRemaining, listenIslandHover }: { providers: readonly UsageProvider[]; showRemaining: boolean; listenIslandHover: GaugeContext["listenIslandHover"] }) {
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
  return providers.map((provider) => <ClaudeUsageGauge key={provider.id} provider={provider} islandHovered={hovered} showRemaining={showRemaining} />);
}

function usageGauge(provider: UsageProvider) {
  return function UsageGauge({ usage, listenIslandHover }: GaugeContext) {
    return <UsageGaugeSlot providers={[provider]} showRemaining={usage.showRemaining} listenIslandHover={listenIslandHover} />;
  };
}

for (const provider of USAGE_PROVIDERS) {
  gaugeSlot.add({
    id: usageItemId(provider),
    order: 70,
    group: "gauges",
    width: CLAUDE_USAGE_GAUGE_WIDTH,
    hideable: true,
    shown: ({ usage }) => usage.enabled && shownUsageProviders(usage.settings).includes(provider),
    component: usageGauge(provider),
  });
}
