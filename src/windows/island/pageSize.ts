import { FUYU_PAGE_ID } from "../../lib/settings/customPanels.ts";
import { pagePanelSize } from "../../lib/settings/pageSizes.ts";
import { MAX_MAX_PANEL_HEIGHT } from "../../lib/settings/settingsLimits.ts";
import type { IslandSettings, PanelPageSize } from "../../lib/settings/types";
import { FUYU_ISLAND_SIZE } from "./custom-panels/panelSize.ts";

export const LIST_PAGE_EXTRA_HEIGHT = 80;
const LIST_PAGES: ReadonlySet<string> = new Set(["todo", "calendar", "clipboard", "qq", "agents"]);

type SizeDefaults = Pick<IslandSettings, "panelWidth" | "maxPanelHeight">;

export function defaultPageSize(defaults: SizeDefaults, page: string): PanelPageSize {
  if (page === FUYU_PAGE_ID) return { width: FUYU_ISLAND_SIZE.width, height: FUYU_ISLAND_SIZE.height };
  const extra = LIST_PAGES.has(page) ? LIST_PAGE_EXTRA_HEIGHT : 0;
  return { width: defaults.panelWidth, height: Math.min(MAX_MAX_PANEL_HEIGHT, defaults.maxPanelHeight + extra) };
}

export function islandPageSize(settings: SizeDefaults & Pick<IslandSettings, "pageSizes">, page: string): PanelPageSize {
  return pagePanelSize(settings.pageSizes, page, defaultPageSize(settings, page));
}
