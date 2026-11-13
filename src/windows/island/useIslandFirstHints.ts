import { useFirstHints } from "../../features/first-hints/useFirstHints";
import type { IslandMode } from "./types";

export function useIslandFirstHints({
  mode,
  isTucked,
  quiet,
  demoActive,
  agentsOn,
  agentSessionCount,
  showsMessage,
  busy,
}: {
  mode: IslandMode;
  isTucked: boolean;
  quiet: boolean;
  demoActive: boolean;
  agentsOn: boolean;
  agentSessionCount: number;
  showsMessage: boolean;
  busy: boolean;
}) {
  return useFirstHints(
    { agent: agentsOn && agentSessionCount > 0, message: showsMessage, tuck: isTucked },
    {
      canShow: mode === "collapsed" && !isTucked && !showsMessage && !busy,
      paused: quiet || demoActive,
    },
  );
}
