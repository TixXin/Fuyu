import type { PluginViewEntry } from "./api";
import { pluginPageId } from "./model.ts";

export type PluginPagePrefs = { order: string[]; hidden: string[] };

const MAX_ENTRIES = 100;

function pageIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string" && entry.startsWith("plugin:") && entry.length <= 200 && !ids.includes(entry)) ids.push(entry);
    if (ids.length >= MAX_ENTRIES) break;
  }
  return ids;
}

export function normalizePluginPagePrefs(value: unknown): PluginPagePrefs {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return { order: pageIds(record.order), hidden: pageIds(record.hidden) };
}

const idOf = (view: PluginViewEntry): string => pluginPageId(view.pluginId, view.viewId);

export function orderPluginViews(views: readonly PluginViewEntry[], prefs: PluginPagePrefs): PluginViewEntry[] {
  const rank = (view: PluginViewEntry) => {
    const index = prefs.order.indexOf(idOf(view));
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };
  return views
    .map((view, index) => ({ view, index }))
    .sort((a, b) => rank(a.view) - rank(b.view) || a.index - b.index)
    .map(({ view }) => view);
}

export function visiblePluginViews(views: readonly PluginViewEntry[], prefs: PluginPagePrefs): PluginViewEntry[] {
  return orderPluginViews(views, prefs).filter((view) => !prefs.hidden.includes(idOf(view)));
}

export function movePluginPage(views: readonly PluginViewEntry[], prefs: PluginPagePrefs, id: string, step: -1 | 1): PluginPagePrefs {
  const ids = orderPluginViews(views, prefs).map(idOf);
  const from = ids.indexOf(id);
  const to = from + step;
  if (from < 0 || to < 0 || to >= ids.length) return prefs;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  const rest = prefs.order.filter((known) => !ids.includes(known));
  return { ...prefs, order: [...ids, ...rest].slice(0, MAX_ENTRIES) };
}

export function setPluginPageHidden(prefs: PluginPagePrefs, id: string, hidden: boolean): PluginPagePrefs {
  const others = prefs.hidden.filter((known) => known !== id);
  return { ...prefs, hidden: hidden ? [...others, id].slice(0, MAX_ENTRIES) : others };
}
