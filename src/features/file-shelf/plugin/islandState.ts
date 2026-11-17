import { createRunnerStore } from "../../plugin-kernel/runnerStore";
import { ISLAND_SIDE_ROW_HEIGHT, type IslandContribution } from "../../plugin-kernel/islandContributions";
import type { FileShelfController } from "../useFileShelf";

export type ShelfIsland = {
  shelf: FileShelfController | null;
  dropping: boolean;
  count: number | null;
};

export const SHELF_COUNT_HINT = "shelf.count";

export const shelfIsland = createRunnerStore<ShelfIsland>({ shelf: null, dropping: false, count: null });

export function shelfContributions(count: number | null): IslandContribution[] {
  return count !== null && count > 0
    ? [{ kind: "side", item: "shelf", height: ISLAND_SIDE_ROW_HEIGHT }, { kind: "hint", key: SHELF_COUNT_HINT }]
    : [];
}
