import { SlotView } from "../../features/plugin-kernel/SlotView";
import type { IslandAlertMeta, SlotEntry } from "../../features/plugin-kernel/slots";
import { useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import { alertSlot, type NotchAlertSources } from "./slots/alerts";
import "./slots/builtins";

export type { NotchAlertSources };

type AlertEntry = SlotEntry<NotchAlertSources, IslandAlertMeta<NotchAlertSources>>;

export function useActiveAlert(): AlertEntry | null {
  const entries = useSlotEntries(alertSlot);
  const { alerts } = useIslandContributed();
  return entries.find((entry) => alerts.has(entry.id)) ?? null;
}

type AlertPartProps = { alert: AlertEntry; sources: NotchAlertSources };

export function NotchAlertLeading({ alert, sources }: AlertPartProps) {
  return <SlotView slot={alertSlot} props={sources} select={() => [alert]} />;
}

export function NotchAlertTrailing({ alert, sources }: AlertPartProps) {
  return <SlotView slot={alertSlot} props={sources} select={() => (alert.trailing ? [{ ...alert, component: alert.trailing }] : [])} />;
}

export function AlertPopup({ alert, sources }: AlertPartProps) {
  return <SlotView slot={alertSlot} props={sources} select={() => [{ ...alert, component: alert.popup }]} />;
}
