import type { IslandContribution } from "../../features/plugin-kernel/islandContributions";
import { useIslandContributions } from "../../features/plugin-kernel/useIslandContributions";
import { SIDE_ROW_HEIGHT } from "./sideColumn";
import type { SideRowSources } from "./slots/side";

type LegacySideInput = SideRowSources & {
  hasMail: boolean;
};

export function useLegacySide(input: LegacySideInput) {
  const { unreadCount, hasMail, shelfCount } = input;
  const list: IslandContribution[] = [];
  if (unreadCount > 0) list.push({ kind: "side", item: "unread", height: SIDE_ROW_HEIGHT });
  if (hasMail) list.push({ kind: "side", item: "mail", height: SIDE_ROW_HEIGHT });
  if (shelfCount !== null && shelfCount > 0) list.push({ kind: "side", item: "shelf", height: SIDE_ROW_HEIGHT });
  useIslandContributions("builtin", "legacy.side", list);
}
