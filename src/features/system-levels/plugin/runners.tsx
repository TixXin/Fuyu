import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { useLevelPopup } from "../useLevelPopup";
import { levelState } from "./islandState";
import { OWNER } from "./owner.ts";

type RunnerProps = {
  mode: string;
  isTucked: boolean;
  quiet: boolean;
};

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function LevelAlerts({ mode, isTucked, quiet }: RunnerProps) {
  const change = useLevelPopup(!quiet && mode === "collapsed" && !isTucked);
  levelState.useProvide(change);
  useIslandContributions(OWNER, "system-levels.alert", change ? [{ kind: "alert", item: "level" }] : []);
  return null;
}

runnerSlot.add({ id: "system-levels.alert", component: LevelAlerts }, OWNER);
