import { useProvideIslandDecor } from "../../plugin-kernel/islandDecor";
import { defineSlot } from "../../plugin-kernel/slots";
import { useAgentActivity } from "../useAgentActivity";
import { useCenterDecor } from "../useCenterDecor";

type RunnerProps = {
  mode: string;
  isTucked: boolean;
  quiet: boolean;
  settings: { agentLightStyle: string };
};

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function CenterPatternRunner({ mode, isTucked, quiet, settings }: RunnerProps) {
  const agents = useAgentActivity();
  const decor = useCenterDecor({ paused: mode !== "collapsed" || isTucked || quiet, agents, markLight: settings.agentLightStyle === "mark" });
  useProvideIslandDecor("center-pattern", decor);
  return null;
}

runnerSlot.add({ id: "center-pattern.runner", component: CenterPatternRunner });
