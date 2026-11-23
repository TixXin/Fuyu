import { isTauri } from "@tauri-apps/api/core";
import { Menu } from "@tauri-apps/api/menu";
import { useCallback, useEffect, useRef, type MouseEvent } from "react";
import { usePluginNames } from "../../features/plugin-kernel/pluginNames";
import { localizedTitle } from "../../features/plugin-kernel/slotTitle";
import type { IslandCollapsedMeta } from "../../features/plugin-kernel/slots";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import { useLocale, useTranslation, type Translations } from "../../i18n";
import { loadCollapsedPlacements, type CollapsedPlacement } from "../../lib/settings/collapsedItems";
import { openSettingsWindow } from "../settings/api";
import { listenIslandMenuAction, openIslandMenu } from "./api";
import { collapsedItemName, collapsedMenuRows, toggleCollapsedMenuItem, type CollapsedMenuRow, type CollapsedNameSources } from "./collapsedMenu";
import { collapsedBarSlot } from "./slots/collapsed";
import { setResizeEditing } from "./resize/session";

export function builtinNames(t: Translations): Record<string, string> {
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

export function entryLabel(entry: Pick<IslandCollapsedMeta, "label"> & { id: string; external: boolean }, t: Translations, locale: string): string | null {
  if (typeof entry.label !== "function") return localizedTitle(entry.label, locale);
  if (entry.external) return null;
  try {
    return entry.label(t);
  } catch (error) {
    console.error(`Failed to name the collapsed bar item ${entry.id}`, error);
    return null;
  }
}

function openNativeMenu(rows: CollapsedMenuRow[], t: Translations, toggle: (id: string) => void) {
  void Menu.new({
    items: [
      ...rows.map((row) => ({ id: `collapsed-item:${row.id}`, text: row.name, checked: row.shown, action: () => toggle(row.id) })),
      { item: "Separator" as const },
      { id: "collapsed-items-arrange", text: t.island.arrangeItems, action: () => openSettingsWindow("islandLayout") },
      { id: "collapsed-resize", text: t.island.resize.menu, action: () => setResizeEditing(true) },
    ],
  })
    .then((menu) => menu.popup())
    .catch((error: unknown) => console.error("Failed to open the collapsed bar menu", error));
}

export function useCollapsedContextMenu(enabled: boolean, save: (next: CollapsedPlacement[]) => void) {
  const t = useTranslation();
  const { locale } = useLocale();
  const pluginNames = usePluginNames();
  const entries = useSlotEntries(collapsedBarSlot);
  const toggleRef = useRef<(id: string) => void>(() => undefined);

  useEffect(() => {
    toggleRef.current = (id) => save(toggleCollapsedMenuItem(entries, loadCollapsedPlacements(), id));
  }, [entries, save]);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    let stop: (() => void) | null = null;
    void listenIslandMenuAction((payload) => {
      if (payload.action === "toggle" && payload.id) toggleRef.current(payload.id);
      if (payload.action === "arrange") openSettingsWindow("islandLayout");
      if (payload.action === "resize") setResizeEditing(true);
    }).then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

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
    const rect = event.currentTarget.getBoundingClientRect();
    const bounds = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    void openIslandMenu(rows, bounds).catch((error: unknown) => {
      console.error("Failed to open the island menu, falling back to the native one", error);
      openNativeMenu(rows, t, (id) => toggleRef.current(id));
    });
  }, [enabled, entries, locale, pluginNames, t]);
}
