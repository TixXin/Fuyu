import { useMemo } from "react";
import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { useFileShelfDrop } from "../island/useFileShelfDrop";
import { useFileShelf } from "../useFileShelf";
import { shelfContributions, shelfIsland } from "./islandState";
import { OWNER } from "./owner";

type RunnerProps = {
  settings: {
    shelfEnabled: boolean;
    shelfShowCount: boolean;
    shelfExpandOnDrop: boolean;
    shelfMaxItems: number;
    shelfAutoCleanupDays: number;
    shelfRemoveMissing: boolean;
    shelfRemoveAfterDragOut: boolean;
  };
  mode: string;
  page: string;
  isTucked: boolean;
  isPeeking: boolean;
  openIslandPage: (page: "shelf") => void;
  setPage: (page: string) => void;
  collapseIsland: () => void;
  tuckIsland: () => void;
  minimizeToEdge: () => void;
};

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function ShelfRunner({ settings, mode, page, isTucked, isPeeking, openIslandPage, setPage, collapseIsland, tuckIsland, minimizeToEdge }: RunnerProps) {
  const shelf = useFileShelf(settings.shelfEnabled, {
    maxItems: settings.shelfMaxItems,
    maxAgeDays: settings.shelfAutoCleanupDays,
    removeMissing: settings.shelfRemoveMissing,
    removeAfterDragOut: settings.shelfRemoveAfterDragOut,
  });
  const dropping = useFileShelfDrop({
    enabled: settings.shelfEnabled,
    expandOnDrop: settings.shelfExpandOnDrop,
    mode,
    page,
    isTucked,
    isPeeking,
    shelf,
    openIslandPage,
    setPage,
    collapseIsland,
    tuckIsland,
    minimizeToEdge,
  });
  const count = settings.shelfEnabled && settings.shelfShowCount ? shelf.items.length : null;
  shelfIsland.useProvide(useMemo(() => ({ shelf, dropping, count }), [shelf, dropping, count]));
  useIslandContributions(OWNER, "file-shelf.count", shelfContributions(count));
  return null;
}

runnerSlot.add({ id: "file-shelf.runner", component: ShelfRunner }, OWNER);
