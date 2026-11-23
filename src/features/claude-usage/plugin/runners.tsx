import { useMemo } from "react";
import type { IslandContribution } from "../../plugin-kernel/islandContributions";
import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandAction, useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { useBuiltinConfig } from "../../plugin-kernel/useBuiltinPlugins";
import { HOVER_ONLY_HINT, shownHoverProviders, shownUsageProviders, usageHint } from "../usageRing";
import { useUsagePresence } from "../useUsagePresence";
import { OWNER } from "./owner.ts";
import { OPEN_USAGE_SETTINGS_ACTION } from "./widgets.ts";

type RunnerProps = {
  openSettings: (section: "agentRings") => void;
};

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function UsageRings({ openSettings }: RunnerProps) {
  const config = useBuiltinConfig(OWNER);
  const chosen = useMemo(() => shownUsageProviders(config), [config]);
  const shown = useUsagePresence(chosen);
  const list = useMemo<IslandContribution[]>(() => {
    const rings = shown.map((provider) => ({ kind: "hint" as const, key: usageHint(provider) }));
    if (rings.length === 0 && shownHoverProviders(config).length > 0) {
      return [{ kind: "hint", key: HOVER_ONLY_HINT }];
    }
    return rings;
  }, [config, shown]);
  useIslandContributions(OWNER, "claude-usage.rings", list);
  useIslandAction(OPEN_USAGE_SETTINGS_ACTION, () => openSettings("agentRings"));
  return null;
}

runnerSlot.add({ id: "claude-usage.rings", component: UsageRings }, OWNER);
