import { useEffect, useState } from "react";
import type { SlotRegistry } from "@fuyu/plugin-base/client";
import { SlotItems } from "@fuyu/plugin-base/client/react";
import { pluginRuntime } from "./runtime";

interface PluginSlotProps {
  window: string;
  name: string;
}

export function PluginSlot({ window, name }: PluginSlotProps) {
  const [registry, setRegistry] = useState<SlotRegistry | null>(null);
  useEffect(() => {
    let live = true;
    void pluginRuntime(window).then((runtime) => {
      if (live) setRegistry(runtime?.registry ?? null);
    });
    return () => {
      live = false;
    };
  }, [window]);
  if (!registry) return null;
  return <SlotItems registry={registry} name={name} />;
}
