import type { IslandContribution } from "../../features/plugin-kernel/islandContributions";
import { useIslandContributions } from "../../features/plugin-kernel/useIslandContributions";
import { SIDE_COVER_HEIGHT, SIDE_ROW_HEIGHT } from "./sideColumn";
import type { SideRowSources } from "./slots/side";

type LegacySideInput = SideRowSources & {
  hasMail: boolean;
  showMusic: boolean;
};

export function useLegacySide(input: LegacySideInput) {
  const { unreadCount, hasMail, showMusic, showCover, mediaState, todoCount, shelfCount } = input;
  const list: IslandContribution[] = [{ kind: "side", item: "agent", height: SIDE_ROW_HEIGHT }];
  if (unreadCount > 0) list.push({ kind: "side", item: "unread", height: SIDE_ROW_HEIGHT });
  if (hasMail) list.push({ kind: "side", item: "mail", height: SIDE_ROW_HEIGHT });
  if (showMusic && (mediaState.available || mediaState.audioActive)) {
    list.push({ kind: "side", item: "music", height: showCover && mediaState.thumbnail ? SIDE_COVER_HEIGHT : SIDE_ROW_HEIGHT });
  }
  if (todoCount !== null && todoCount > 0) list.push({ kind: "side", item: "todo", height: SIDE_ROW_HEIGHT });
  if (shelfCount !== null && shelfCount > 0) list.push({ kind: "side", item: "shelf", height: SIDE_ROW_HEIGHT });
  useIslandContributions("builtin", "legacy.side", list);
}
