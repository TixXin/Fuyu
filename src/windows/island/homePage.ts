import { FUYU_PAGE_ID } from "../../lib/settings/customPanels.ts";
import { isPageEnabled, isPageShown, pageShortcutOrder, type IslandFeatures } from "./features.ts";
import type { IslandPage } from "./types";

export function resolveHomePage({
  rememberLastPage,
  urgentPage,
  page,
  features,
}: {
  rememberLastPage: boolean;
  urgentPage: IslandPage | null;
  page: IslandPage;
  features: IslandFeatures;
}): IslandPage {
  if (urgentPage && isPageEnabled(urgentPage, features)) return urgentPage;
  if (rememberLastPage && isPageShown(page, features)) return page;
  if (isPageShown(FUYU_PAGE_ID, features)) return FUYU_PAGE_ID;
  return pageShortcutOrder(features)[0] ?? page;
}
