import type { IslandContribution } from "../../features/plugin-kernel/islandContributions";
import { useIslandContributions } from "../../features/plugin-kernel/useIslandContributions";
import { SIDE_ROW_HEIGHT } from "./sideColumn";
import type { SideRowSources } from "./slots/side";

export function useLegacySide({ shelfCount }: SideRowSources) {
  const list: IslandContribution[] = [];
  if (shelfCount !== null && shelfCount > 0) list.push({ kind: "side", item: "shelf", height: SIDE_ROW_HEIGHT });
  useIslandContributions("builtin", "legacy.side", list);
}
