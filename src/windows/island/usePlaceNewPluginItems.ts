import { useEffect, useSyncExternalStore } from "react";
import { islandSpotlight } from "../../features/plugin-kernel/islandSpotlight";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import type { CollapsedPlacement } from "../../lib/settings/collapsedItems";
import { placeFreshItems } from "./pluginPlacement";
import { collapsedBarSlot } from "./slots/collapsed";

export function usePlaceNewPluginItems(offered: readonly string[], saved: readonly CollapsedPlacement[], placements: readonly CollapsedPlacement[], save: (next: CollapsedPlacement[]) => void) {
  const owner = useSyncExternalStore(islandSpotlight.subscribe, islandSpotlight.owner, islandSpotlight.owner);
  const entries = useSlotEntries(collapsedBarSlot);
  const fresh = owner === null ? [] : entries.filter((entry) => entry.external && entry.owner === owner).map((entry) => entry.id);
  const next = fresh.length === 0 ? null : placeFreshItems(saved, placements, offered, fresh);
  const key = next === null ? "" : JSON.stringify(next);
  useEffect(() => {
    if (key !== "") save(JSON.parse(key) as CollapsedPlacement[]);
  }, [key, save]);
}
