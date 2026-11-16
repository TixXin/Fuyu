import type { IslandSettings } from "../../../lib/settings/types";
import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { useLevelPopup } from "../useLevelPopup";
import { levelState } from "./islandState";

type RunnerProps = {
  mode: string;
  isTucked: boolean;
  quiet: boolean;
  settings: Pick<IslandSettings, "levelPopup">;
};

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function LevelAlerts({ mode, isTucked, quiet, settings }: RunnerProps) {
  const change = useLevelPopup(settings.levelPopup, !quiet && mode === "collapsed" && !isTucked);
  levelState.useProvide(change);
  useIslandContributions("builtin", "system-levels.alert", change ? [{ kind: "alert", item: "level" }] : []);
  return null;
}

runnerSlot.add({ id: "system-levels.alert", component: LevelAlerts });
