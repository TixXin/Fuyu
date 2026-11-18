import { useMemo } from "react";
import type { IslandContribution } from "../../plugin-kernel/islandContributions";
import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { useBuiltinConfig } from "../../plugin-kernel/useBuiltinPlugins";
import { HOVER_ONLY_HINT, needsHoverOnlyGauge, shownUsageProviders, usageHint } from "../usageRing";
import { OWNER } from "./owner.ts";

const runnerSlot = defineSlot<object>("island.runner/v1");

function UsageRings() {
  const config = useBuiltinConfig(OWNER);
  const list = useMemo<IslandContribution[]>(() => {
    const rings = shownUsageProviders(config).map((provider) => ({ kind: "hint" as const, key: usageHint(provider) }));
    if (rings.length === 0 && needsHoverOnlyGauge(config)) {
      return [{ kind: "hint", key: HOVER_ONLY_HINT }];
    }
    return rings;
  }, [config]);
  useIslandContributions(OWNER, "claude-usage.rings", list);
  return null;
}

runnerSlot.add({ id: "claude-usage.rings", component: UsageRings }, OWNER);
