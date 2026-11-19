import { useMemo } from "react";
import { useLocale, useTranslation } from "../../../i18n";
import { useTrackArt } from "../../../lib/now-playing/trackArt";
import { packageIconUrl } from "../../plugin-kernel/packageIconUrl";
import { PLUGIN_BASE } from "../../plugin-kernel/pluginBase";
import { usePluginIcons, usePluginNames } from "../../plugin-kernel/pluginNames";
import { arrivalsHeading, type ArrivalsHeading, type HeadingArrival } from "./arrivalsHeading.ts";

export function useArrivalsHeading(arrivals: readonly HeadingArrival[] | null): ArrivalsHeading | null {
  const t = useTranslation().messages;
  const { locale } = useLocale();
  const art = useTrackArt();
  const names = usePluginNames();
  const paths = usePluginIcons();
  const icons = useMemo(() => {
    const urls = new Map<string, string>();
    for (const [id, path] of paths) {
      const url = packageIconUrl(PLUGIN_BASE, id, path);
      if (url) urls.set(id, url);
    }
    return urls;
  }, [paths]);
  const trackChange = t.arrivals.trackChange;
  const label = art?.sourceLabel ?? null;
  const icon = art?.sourceIcon ?? null;
  return useMemo(
    () => arrivalsHeading(arrivals, { sourceLabel: label, sourceIcon: icon }, names, locale, trackChange, icons),
    [arrivals, label, icon, names, locale, trackChange, icons],
  );
}
