import { useMemo } from "react";
import { useLocale, useTranslation } from "../../../i18n";
import { useTrackArt } from "../../../lib/now-playing/trackArt";
import { usePluginNames } from "../../plugin-kernel/pluginNames";
import { arrivalsHeading, type ArrivalsHeading, type HeadingArrival } from "./arrivalsHeading.ts";

export function useArrivalsHeading(arrivals: readonly HeadingArrival[] | null): ArrivalsHeading | null {
  const t = useTranslation().messages;
  const { locale } = useLocale();
  const art = useTrackArt();
  const names = usePluginNames();
  const trackChange = t.arrivals.trackChange;
  const label = art?.sourceLabel ?? null;
  const icon = art?.sourceIcon ?? null;
  return useMemo(
    () => arrivalsHeading(arrivals, { sourceLabel: label, sourceIcon: icon }, names, locale, trackChange),
    [arrivals, label, icon, names, locale, trackChange],
  );
}
