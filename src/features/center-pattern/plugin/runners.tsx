import { useProvideIslandDecor } from "../../plugin-kernel/islandDecor";
import { defineSlot } from "../../plugin-kernel/slots";
import { useBuiltinConfig, useBuiltinEnabled } from "../../plugin-kernel/useBuiltinPlugins";
import { useAgentActivity } from "../useAgentActivity";
import { useCenterDecor } from "../useCenterDecor";
import { OWNER } from "./owner.ts";

type RunnerProps = {
  mode: string;
  isTucked: boolean;
  quiet: boolean;
  settings: { agentLightStyle: string };
};

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function CenterPatternRunner({ mode, isTucked, quiet, settings }: RunnerProps) {
  const agents = useAgentActivity();
  const enabled = useBuiltinEnabled(OWNER);
  const config = useBuiltinConfig(OWNER);
  const decor = useCenterDecor({
    paused: mode !== "collapsed" || isTucked || quiet,
    agents,
    markLight: settings.agentLightStyle === "mark",
    enabled,
    settings: config,
  });
  useProvideIslandDecor(OWNER, decor);
  return null;
}

runnerSlot.add({ id: "center-pattern.runner", component: CenterPatternRunner }, OWNER);
