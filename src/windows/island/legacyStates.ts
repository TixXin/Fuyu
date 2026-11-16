import type { IslandContribution } from "../../features/plugin-kernel/islandContributions";
import { useIslandContributions } from "../../features/plugin-kernel/useIslandContributions";

type LegacyStateInput = {
  showsMessage: boolean;
  prompting: boolean;
  peeking: boolean;
  recording: boolean;
  hold: boolean;
  agentsActive: boolean;
};

export function useLegacyStates({ showsMessage, prompting, peeking, recording, hold, agentsActive }: LegacyStateInput) {
  const list: IslandContribution[] = [];
  if (showsMessage) list.push({ kind: "reveal", reveal: "always", pauseIdle: true, pauseHover: true }, { kind: "busy" }, { kind: "hint", key: "message" });
  if (prompting) list.push({ kind: "reveal", reveal: "always" }, { kind: "busy" });
  if (peeking) list.push({ kind: "reveal", reveal: "allowed", pauseIdle: true }, { kind: "busy" });
  if (recording) list.push({ kind: "busy" });
  if (hold) list.push({ kind: "hold", reason: "legacy" });
  if (agentsActive) list.push({ kind: "hint", key: "agent" });
  useIslandContributions("builtin", "legacy.states", list);
}
