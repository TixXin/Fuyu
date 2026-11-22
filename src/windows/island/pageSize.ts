import { pagePanelSize } from "../../lib/settings/pageSizes.ts";
import type { IslandSettings, PanelPageSize } from "../../lib/settings/types";

type SizeDefaults = Pick<IslandSettings, "panelWidth" | "maxPanelHeight">;

export function defaultPageSize(defaults: SizeDefaults): PanelPageSize {
  return { width: defaults.panelWidth, height: defaults.maxPanelHeight };
}

export function islandPageSize(settings: SizeDefaults & Pick<IslandSettings, "pageSizes">, page: string): PanelPageSize {
  return pagePanelSize(settings.pageSizes, page, defaultPageSize(settings));
}
