import type { IslandContribution } from "../../features/plugin-kernel/islandContributions";
import { useIslandContributions } from "../../features/plugin-kernel/useIslandContributions";

export function useLegacyStates({ prompting }: { prompting: boolean }) {
  const list: IslandContribution[] = [];
  if (prompting) list.push({ kind: "reveal", reveal: "always" }, { kind: "busy" });
  useIslandContributions("builtin", "legacy.states", list);
}
