import { useFileShelf } from "../../features/file-shelf/useFileShelf";
import type { IslandSettings } from "../../lib/settings/types";
import { useFileShelfDrop } from "../../features/file-shelf/island/useFileShelfDrop";
import type { useIslandNavigation } from "./useIslandNavigation";

export function useIslandShelf(settings: IslandSettings, navigation: ReturnType<typeof useIslandNavigation>) {
  const { mode, page, isTucked, isPeeking, openIslandPage, setPage, collapseIsland, tuckIsland, minimizeToEdge } = navigation;
  const fileShelf = useFileShelf(settings.shelfEnabled, {
    maxItems: settings.shelfMaxItems,
    maxAgeDays: settings.shelfAutoCleanupDays,
    removeMissing: settings.shelfRemoveMissing,
    removeAfterDragOut: settings.shelfRemoveAfterDragOut,
  });
  const isShelfDropping = useFileShelfDrop({
    enabled: settings.shelfEnabled,
    expandOnDrop: settings.shelfExpandOnDrop,
    mode,
    page,
    isTucked,
    isPeeking,
    shelf: fileShelf,
    openIslandPage,
    setPage,
    collapseIsland,
    tuckIsland,
    minimizeToEdge,
  });
  return { fileShelf, isShelfDropping };
}
