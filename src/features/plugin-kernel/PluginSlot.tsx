import { useEffect, useMemo } from "react";
import type { SlotRegistry } from "@fuyu/plugin-base/client/slots";
import { pluginRuntime } from "./runtime";
import { defineSlot, windowSlots, type SlotName, type SlotWindow } from "./slots";
import { SlotView } from "./SlotView";

export function PluginSlotItems({ registry, name }: { registry: SlotRegistry; name: SlotName }) {
  const slot = useMemo(() => defineSlot<Record<never, never>>(name, registry), [registry, name]);
  return <SlotView slot={slot} />;
}

export function PluginSlot({ window, name }: { window: SlotWindow; name: SlotName }) {
  useEffect(() => {
    void pluginRuntime(window);
  }, [window]);
  return <PluginSlotItems registry={windowSlots(window)} name={name} />;
}
