import { useMemo } from "react";
import type { IslandContribution } from "../../plugin-kernel/islandContributions";
import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { useBuiltinConfig } from "../../plugin-kernel/useBuiltinPlugins";
import { shownUsageProviders, usageHint } from "../usageRing";
import { OWNER } from "./owner.ts";

const runnerSlot = defineSlot<object>("island.runner/v1");

function UsageRings() {
  const config = useBuiltinConfig(OWNER);
  const list = useMemo<IslandContribution[]>(() => shownUsageProviders(config).map((provider) => ({ kind: "hint", key: usageHint(provider) })), [config]);
  useIslandContributions(OWNER, "claude-usage.rings", list);
  return null;
}

runnerSlot.add({ id: "claude-usage.rings", component: UsageRings }, OWNER);
