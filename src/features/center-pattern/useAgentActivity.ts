import { agentsV1 } from "@fuyu/plugin-services";
import { useEffect, useState } from "react";
import { windowServices } from "../plugin-kernel/services";
import { activityOf, type AgentActivity } from "./centerSettings";

const agents = windowServices.get(agentsV1);
const NO_ACTIVITY: readonly AgentActivity[] = [];

export function useAgentActivity(): readonly AgentActivity[] {
  const [activity, setActivity] = useState(NO_ACTIVITY);
  useEffect(() => {
    let live = true;
    let asked = 0;
    const load = () => {
      const ask = ++asked;
      agents.sessions().then(
        (answer) => live && ask === asked && setActivity(activityOf(answer)),
        () => live && ask === asked && setActivity(NO_ACTIVITY),
      );
    };
    load();
    const off = agents.on("changed", load);
    const unwatch = windowServices.watch(load);
    return () => {
      live = false;
      void off();
      unwatch();
    };
  }, []);
  return activity;
}
