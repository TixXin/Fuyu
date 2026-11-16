import { useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";
import { useFirstHints } from "./first-hints/useFirstHints";
import type { IslandMode } from "./types";

export function useIslandFirstHints({
  mode,
  isTucked,
  quiet,
  demoActive,
}: {
  mode: IslandMode;
  isTucked: boolean;
  quiet: boolean;
  demoActive: boolean;
}) {
  const { busy, hints } = useIslandContributed();
  return useFirstHints(
    { agent: hints.has("agent"), message: hints.has("message"), tuck: isTucked },
    {
      canShow: mode === "collapsed" && !isTucked && !busy,
      paused: quiet || demoActive,
    },
  );
}
