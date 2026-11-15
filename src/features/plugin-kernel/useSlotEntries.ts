import { useSlotItems } from "@fuyu/plugin-base/client/react";
import type { SlotEntry, SlotHandle } from "./slots";

export function useSlotEntries<Props extends object, Meta extends object>(slot: SlotHandle<Props, Meta>, group?: string): readonly SlotEntry<Props, Meta>[] {
  return useSlotItems(slot.registry, slot.name, group) as unknown as SlotEntry<Props, Meta>[];
}
