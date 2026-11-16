import { useCallback, useSyncExternalStore } from "react";
import { defineSlot } from "../../plugin-kernel/slots";
import { islandContributions } from "../../plugin-kernel/useIslandContributions";
import { useBackgroundUpdateCheck } from "../useBackgroundUpdateCheck";
import { useIslandAutoUpdate } from "../useIslandAutoUpdate";
import { useUpdateContributions } from "./updateIsland";

type RunnerProps = {
  mode: string;
  openSettings: (section: "updates") => void;
};

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

const agentsBusy = () => islandContributions.snapshot().hints.has("agents.busy");

function UpdaterRunner({ mode, openSettings }: RunnerProps) {
  const openUpdates = useCallback(() => openSettings("updates"), [openSettings]);
  useBackgroundUpdateCheck(openUpdates);
  useIslandAutoUpdate({ mode, agentsBusy: useSyncExternalStore(islandContributions.subscribe, agentsBusy, agentsBusy) });
  useUpdateContributions(openUpdates);
  return null;
}

runnerSlot.add({ id: "updater.runner", component: UpdaterRunner });
