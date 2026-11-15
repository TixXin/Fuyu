import { SlotView } from "../../features/plugin-kernel/SlotView";
import type { IslandAlertMeta, SlotEntry } from "../../features/plugin-kernel/slots";
import { alertSlot, type NotchAlertSources } from "./slots/alerts";

export type { NotchAlertSources };

type AlertEntry = SlotEntry<NotchAlertSources, IslandAlertMeta<NotchAlertSources>>;

function firstActive(items: readonly AlertEntry[], sources: NotchAlertSources): AlertEntry[] {
  const item = items.find((entry) => entry.active(sources));
  return item ? [item] : [];
}

export function hasNotchAlert(sources: NotchAlertSources) {
  return alertSlot.items().some((item) => item.active(sources));
}

export function NotchAlertLeading(sources: NotchAlertSources) {
  return <SlotView slot={alertSlot} props={sources} select={(items) => firstActive(items, sources)} />;
}

export function NotchAlertTrailing(sources: NotchAlertSources) {
  return <SlotView slot={alertSlot} props={sources} select={(items) => firstActive(items, sources).flatMap((item) => (item.trailing ? [{ ...item, component: item.trailing }] : []))} />;
}
