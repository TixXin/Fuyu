import { agentShell } from "../../agent-status/plugin/islandState";
import { useProvideIslandDecor } from "../../plugin-kernel/islandDecor";
import { defineSlot } from "../../plugin-kernel/slots";
import { useCenterDecor } from "../useCenterDecor";

type RunnerProps = {
  mode: string;
  isTucked: boolean;
  quiet: boolean;
  settings: { agentLightStyle: string };
};

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function CenterPatternRunner({ mode, isTucked, quiet, settings }: RunnerProps) {
  const decor = useCenterDecor({ paused: mode !== "collapsed" || isTucked || quiet, agents: agentShell.use().activity, markLight: settings.agentLightStyle === "mark" });
  useProvideIslandDecor("center-pattern", decor);
  return null;
}

runnerSlot.add({ id: "center-pattern.runner", component: CenterPatternRunner });
