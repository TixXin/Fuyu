import { useCallback } from "react";
import { useProvideIslandDecor } from "../../plugin-kernel/islandDecor";
import { defineSlot } from "../../plugin-kernel/slots";
import { useRingConfig } from "../useRingConfig";
import { useRingSessions } from "../useRingSessions";
import { useSessionRingDecor } from "../useSessionRingDecor";
import { OWNER } from "./owner.ts";

type RunnerProps = {
  mode: string;
  isTucked: boolean;
  quiet: boolean;
  settings: { agentStatusEnabled: boolean };
  openIslandPage: (page: "agents") => void;
};

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function SessionRingRunner({ mode, isTucked, quiet, settings, openIslandPage }: RunnerProps) {
  const sessions = useRingSessions();
  const [config] = useRingConfig();
  const onOpenAgents = useCallback(() => openIslandPage("agents"), [openIslandPage]);
  const decor = useSessionRingDecor({ paused: mode !== "collapsed" || isTucked || quiet, sessions, config, agentsOn: settings.agentStatusEnabled, onOpenAgents });
  useProvideIslandDecor("session-ring", decor);
  return null;
}

runnerSlot.add({ id: "session-ring.runner", component: SessionRingRunner }, OWNER);
