import { useEffect } from "react";
import { onPluginBarUsageRequest, reportPluginBarUsage } from "../api";
import { measureBarUsage } from "../barMeasure";
import { defineSlot } from "../slots";

function BarUsageReporter() {
  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    void onPluginBarUsageRequest((id) => {
      void reportPluginBarUsage(measureBarUsage(id)).catch(() => undefined);
    })
      .then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)))
      .catch((error: unknown) => console.error("Failed to listen for collapsed bar usage requests", error));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
  return null;
}

defineSlot("island.runner/v1").add({ id: "plugin-kernel.bar-usage", component: BarUsageReporter });
