import { useEffect, useSyncExternalStore } from "react";
import type { WidgetSizesOf } from "../../lib/settings/customPanels";
import { getSystemStats } from "./api";
import { BATTERY_WIDGET } from "./plugin/widgets.ts";

let hasBattery: boolean | null = null;
let probing = false;
const listeners = new Set<() => void>();

function probe() {
  if (hasBattery !== null || probing) return;
  probing = true;
  void getSystemStats()
    .then((stats) => {
      if (!stats || typeof stats !== "object") return;
      hasBattery = stats.battery !== null;
      for (const listener of listeners) listener();
    })
    .catch((failure: unknown) => console.error("Failed to check for a battery", failure))
    .finally(() => {
      probing = false;
    });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useHasBattery(): boolean | null {
  useEffect(probe, []);
  return useSyncExternalStore(subscribe, () => hasBattery);
}

export function skipMissingBattery(sizesOf: WidgetSizesOf, battery: boolean | null): WidgetSizesOf {
  return battery === false ? (widget) => (widget === BATTERY_WIDGET.id ? null : sizesOf(widget)) : sizesOf;
}
