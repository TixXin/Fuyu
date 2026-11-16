import { useCallback } from "react";
import { agentShell } from "../../agent-status/plugin/islandState";
import { useProvideIslandDecor } from "../../plugin-kernel/islandDecor";
import { defineSlot } from "../../plugin-kernel/slots";
import { useSessionRingDecor } from "../useSessionRingDecor";

type RunnerProps = {
  mode: string;
  isTucked: boolean;
  quiet: boolean;
  settings: { agentStatusEnabled: boolean };
  openIslandPage: (page: "agents") => void;
};

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function SessionRingRunner({ mode, isTucked, quiet, settings, openIslandPage }: RunnerProps) {
  const { listed, unseenKeys } = agentShell.use();
  const onOpenAgents = useCallback(() => openIslandPage("agents"), [openIslandPage]);
  const decor = useSessionRingDecor({ paused: mode !== "collapsed" || isTucked || quiet, sessions: listed, unseen: unseenKeys, agentsOn: settings.agentStatusEnabled, onOpenAgents });
  useProvideIslandDecor("session-ring", decor);
  return null;
}

runnerSlot.add({ id: "session-ring.runner", component: SessionRingRunner });
