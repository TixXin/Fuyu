import { useMemo } from "react";
import { pluginPageId } from "../../features/plugin-views/model";
import { visiblePluginViews } from "../../features/plugin-views/pagePrefs";
import { usePluginPagePrefs } from "../../features/plugin-views/usePluginPagePrefs";
import { usePluginViews } from "../../features/plugin-views/usePluginViews";
import { isPluginPage } from "./features";
import type { IslandPage, PluginPageId } from "./types";

/**
 * The plugin pages the island shows (in the order set in settings, hidden ones
 * left out) and the entry of the open one (null on a built-in page).
 */
export function usePluginPages(page: IslandPage) {
  const allViews = usePluginViews();
  const [prefs] = usePluginPagePrefs();
  const views = useMemo(() => visiblePluginViews(allViews, prefs), [allViews, prefs]);
  const pageIds = useMemo<PluginPageId[]>(() => views.map((view) => pluginPageId(view.pluginId, view.viewId)), [views]);
  const entry = isPluginPage(page) ? views.find((view) => pluginPageId(view.pluginId, view.viewId) === page) ?? null : null;
  return { views, pageIds, entry };
}
