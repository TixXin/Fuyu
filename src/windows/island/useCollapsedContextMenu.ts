import { isTauri } from "@tauri-apps/api/core";
import { Menu } from "@tauri-apps/api/menu";
import { useCallback, type MouseEvent } from "react";
import { usePluginNames } from "../../features/plugin-kernel/pluginNames";
import { localizedTitle } from "../../features/plugin-kernel/slotTitle";
import type { IslandCollapsedMeta } from "../../features/plugin-kernel/slots";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import { useLocale, useTranslation, type Translations } from "../../i18n";
import { loadCollapsedPlacements, type CollapsedPlacement } from "../../lib/settings/collapsedItems";
import { openSettingsWindow } from "../settings/api";
import { collapsedItemName, collapsedMenuRows, toggleCollapsedMenuItem, type CollapsedNameSources } from "./collapsedMenu";
import { collapsedBarSlot } from "./slots/collapsed";

function builtinNames(t: Translations): Record<string, string> {
  const item = t.settings.collapsedItems.item;
  return {
    "status-light": item.statusLight,
    mail: item.mail,
    update: item.update,
    "device-use": item.deviceUse,
    shelf: item.shelf,
    music: item.music,
    "session-count": item.sessionCount,
    timer: t.island.timer,
  };
}

function entryLabel(entry: Pick<IslandCollapsedMeta, "label"> & { id: string; external: boolean }, t: Translations, locale: string): string | null {
  if (typeof entry.label !== "function") return localizedTitle(entry.label, locale);
  if (entry.external) return null;
  try {
    return entry.label(t);
  } catch (error) {
    console.error(`Failed to name the collapsed bar item ${entry.id}`, error);
    return null;
  }
}

export function useCollapsedContextMenu(enabled: boolean, save: (next: CollapsedPlacement[]) => void) {
  const t = useTranslation();
  const { locale } = useLocale();
  const pluginNames = usePluginNames();
  const entries = useSlotEntries(collapsedBarSlot);

  return useCallback((event: MouseEvent<HTMLElement>) => {
    if (!enabled || event.defaultPrevented || !isTauri()) return;
    event.preventDefault();
    const labels = new Map<string, string>();
    for (const entry of entries) {
      const label = entryLabel(entry, t, locale);
      if (label) labels.set(entry.id, label);
    }
    const plugins = new Map<string, string>();
    for (const [id, title] of pluginNames) {
      const name = localizedTitle(title, locale);
      if (name) plugins.set(id, name);
    }
    const sources: CollapsedNameSources = { labels, builtin: builtinNames(t), plugins };
    const rows = collapsedMenuRows(entries, loadCollapsedPlacements(), (entry) => collapsedItemName(entry, entries, sources));
    void Menu.new({
      items: [
        ...rows.map((row) => ({
          id: `collapsed-item:${row.id}`,
          text: row.name,
          checked: row.shown,
          action: () => save(toggleCollapsedMenuItem(entries, loadCollapsedPlacements(), row.id)),
        })),
        { item: "Separator" as const },
        { id: "collapsed-items-arrange", text: t.island.arrangeItems, action: () => openSettingsWindow("appearanceCollapsed") },
      ],
    })
      .then((menu) => menu.popup())
      .catch((error: unknown) => console.error("Failed to open the collapsed bar menu", error));
  }, [enabled, entries, locale, pluginNames, save, t]);
}
