import { FUYU_PAGE_ID } from "../../lib/settings/customPanels.ts";
import { pagePanelSize } from "../../lib/settings/pageSizes.ts";
import type { IslandSettings, PanelPageSize } from "../../lib/settings/types";
import { FUYU_ISLAND_SIZE } from "./custom-panels/panelSize.ts";

type SizeDefaults = Pick<IslandSettings, "panelWidth" | "maxPanelHeight">;

export function defaultPageSize(defaults: SizeDefaults, page: string): PanelPageSize {
  const size = { width: defaults.panelWidth, height: defaults.maxPanelHeight };
  if (page !== FUYU_PAGE_ID) return size;
  return { width: Math.max(FUYU_ISLAND_SIZE.width, size.width), height: Math.max(FUYU_ISLAND_SIZE.height, size.height) };
}

export function islandPageSize(settings: SizeDefaults & Pick<IslandSettings, "pageSizes">, page: string): PanelPageSize {
  return pagePanelSize(settings.pageSizes, page, defaultPageSize(settings, page));
}
