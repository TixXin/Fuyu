import { SlotView } from "./SlotView";
import { islandPlacementLinks } from "./settingsSlots";

export function IslandPlacementRow({ item, title }: { item: string; title?: string }) {
  return <SlotView slot={islandPlacementLinks} group="islandPlacementLink" props={{ item, title }} />;
}
