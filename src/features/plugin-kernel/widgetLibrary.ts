import type { ComponentType } from "react";
import type { Translations } from "../../i18n";
import { PANEL_SIZES, type PanelSize } from "../../lib/settings/customPanels.ts";
import { localizedTitle } from "./slotTitle.ts";

export type WidgetIcon = ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string; "aria-hidden"?: boolean | "true" }>;

export type LibraryWidget = {
  id: string;
  name: string;
  icon: WidgetIcon;
  group: string;
  groupName: string;
  plugin: boolean;
  sizes: PanelSize[];
  available: boolean;
};

export type WidgetLibrary = {
  widgets: readonly LibraryWidget[];
  find: (id: string) => LibraryWidget | undefined;
};

export type WidgetEntry = { id: string; owner: string; external: boolean; sizes?: unknown; label?: unknown; group?: unknown; icon?: unknown };

export const panelSizesOf = (sizes: unknown): PanelSize[] => (Array.isArray(sizes) ? PANEL_SIZES.filter((size) => sizes.includes(size)) : []);

export function widgetName(entry: WidgetEntry, t: Translations, locale: string, pluginName: string | null): string {
  if (typeof entry.label === "function") {
    const text: unknown = (entry.label as (t: Translations) => unknown)(t);
    if (typeof text === "string" && text.trim() !== "") return text;
  }
  return localizedTitle(entry.label, locale) ?? pluginName ?? entry.id;
}

export function groupName(group: string, t: Translations): string {
  const groups = t.islandWidgets.groups as Record<string, string>;
  return groups[group] ?? group;
}

export function makeWidgetLibrary(widgets: readonly LibraryWidget[]): WidgetLibrary {
  const byId = new Map(widgets.map((widget) => [widget.id, widget]));
  return { widgets: widgets.filter((widget) => widget.available), find: (id) => byId.get(id) };
}

export function groupWidgets(widgets: readonly LibraryWidget[]): [string, string, LibraryWidget[]][] {
  const groups = new Map<string, [string, string, LibraryWidget[]]>();
  for (const widget of widgets) {
    const key = `${widget.plugin ? "plugin" : "builtin"}:${widget.group}`;
    const entry = groups.get(key) ?? [key, widget.groupName, []];
    entry[2].push(widget);
    groups.set(key, entry);
  }
  return [...groups.values()];
}
