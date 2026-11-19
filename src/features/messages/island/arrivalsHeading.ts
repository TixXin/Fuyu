import { localizedTitle } from "../../plugin-kernel/slotTitle.ts";

export type ArrivalsHeading = { label: string; icon: "music" | "bell"; iconUrl?: string };

export type HeadingArrival = { source: string; mediaControls?: boolean; pluginId?: string };

export type HeadingArt = { sourceLabel: string | null; sourceIcon: string | null };

export function arrivalsHeading(
  arrivals: readonly HeadingArrival[] | null,
  art: HeadingArt | null,
  names: ReadonlyMap<string, unknown>,
  locale: string,
  trackChange: string,
): ArrivalsHeading | null {
  if (!arrivals || arrivals.length !== 1 || arrivals[0].source !== "plugin") return null;
  const [only] = arrivals;
  if (only.mediaControls) {
    return { label: art?.sourceLabel ?? trackChange, icon: "music", ...(art?.sourceIcon ? { iconUrl: art.sourceIcon } : {}) };
  }
  const name = only.pluginId ? localizedTitle(names.get(only.pluginId), locale) : null;
  return name ? { label: name, icon: "bell" } : null;
}
