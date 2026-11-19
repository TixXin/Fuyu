import { useCallback } from "react";
import { usePluginNames } from "../../features/plugin-kernel/pluginNames";
import { localizedTitle } from "../../features/plugin-kernel/slotTitle";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import { useLocale, useTranslation } from "../../i18n";
import { collapsedItemName, type CollapsedNameSources } from "./collapsedMenu";
import { collapsedBarSlot } from "./slots/collapsed";
import { builtinNames, entryLabel } from "./useCollapsedContextMenu";

export function useCollapsedItemNames() {
  const t = useTranslation();
  const { locale } = useLocale();
  const pluginNames = usePluginNames();
  const entries = useSlotEntries(collapsedBarSlot);

  return useCallback((id: string) => {
    const entry = entries.find((candidate) => candidate.id === id);
    if (!entry) return id;
    const labels = new Map<string, string>();
    const label = entryLabel(entry, t, locale);
    if (label) labels.set(entry.id, label);
    const plugins = new Map<string, string>();
    for (const [plugin, title] of pluginNames) {
      const name = localizedTitle(title, locale);
      if (name) plugins.set(plugin, name);
    }
    const sources: CollapsedNameSources = { labels, builtin: builtinNames(t), plugins };
    return collapsedItemName(entry, entries, sources);
  }, [entries, locale, pluginNames, t]);
}
