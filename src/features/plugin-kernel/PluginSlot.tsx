import { useEffect, useState } from "react";
import type { SlotRegistry } from "@fuyu/plugin-base/client";
import { SlotItems } from "@fuyu/plugin-base/client/react";
import { pluginRuntime } from "./runtime";
import "./PluginSlot.css";

interface PluginSlotProps {
  window: string;
  name: string;
}

export function PluginSlotItems({ registry, name }: { registry: SlotRegistry; name: string }) {
  return (
    <div className="plugin-slot" data-slot={name}>
      <SlotItems registry={registry} name={name} />
    </div>
  );
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
  return <PluginSlotItems registry={registry} name={name} />;
}
