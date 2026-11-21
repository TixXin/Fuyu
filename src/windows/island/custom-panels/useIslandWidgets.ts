import { useMemo } from "react";
import { Puzzle } from "lucide-react";
import { usePluginNames } from "../../../features/plugin-kernel/pluginNames";
import { localizedTitle } from "../../../features/plugin-kernel/slotTitle";
import { useSlotEntries } from "../../../features/plugin-kernel/useSlotEntries";
import { groupName, makeWidgetLibrary, panelSizesOf, widgetName, type LibraryWidget, type WidgetIcon, type WidgetLibrary } from "../../../features/plugin-kernel/widgetLibrary";
import { useLocale, useTranslation } from "../../../i18n";
import { widgetSlot } from "../slots/widget";

export function useIslandWidgets(): WidgetLibrary {
  const entries = useSlotEntries(widgetSlot);
  const t = useTranslation();
  const { locale } = useLocale();
  const names = usePluginNames();
  return useMemo(() => {
    const widgets = entries.flatMap((entry): LibraryWidget[] => {
      const sizes = panelSizesOf(entry.sizes);
      if (sizes.length === 0) return [];
      const plugin = entry.external ? (localizedTitle(names.get(entry.owner), locale) ?? entry.owner) : null;
      const group = entry.external ? entry.owner : (entry.group ?? entry.owner);
      return [{
        id: entry.id,
        name: widgetName(entry, t, locale, plugin),
        icon: (entry.icon as WidgetIcon | undefined) ?? Puzzle,
        group,
        groupName: plugin ?? groupName(group, t),
        plugin: entry.external,
        sizes,
        available: true,
      }];
    });
    return makeWidgetLibrary(widgets);
  }, [entries, locale, names, t]);
}
