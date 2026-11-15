import { DeviceAlertLeading, DeviceAlertTrailing, LevelAlertLeading, LevelAlertTrailing, QuotaAlertLeading, QuotaAlertTrailing, type NotchAlertSources } from "./slots/alerts";

export type { NotchAlertSources };

export function hasNotchAlert({ deviceAlert, quotaAlert, levelPopup }: NotchAlertSources) {
  return Boolean(deviceAlert || quotaAlert || levelPopup);
}

export function NotchAlertLeading(sources: NotchAlertSources) {
  if (sources.deviceAlert) return <DeviceAlertLeading {...sources} />;
  if (sources.quotaAlert) return <QuotaAlertLeading {...sources} />;
  return <LevelAlertLeading {...sources} />;
}

export function NotchAlertTrailing(sources: NotchAlertSources) {
  if (sources.deviceAlert) return <DeviceAlertTrailing {...sources} />;
  if (sources.quotaAlert) return <QuotaAlertTrailing {...sources} />;
  return <LevelAlertTrailing {...sources} />;
}
