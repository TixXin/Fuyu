import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_PAGE_NEXT_SHORTCUT,
  DEFAULT_PAGE_PREVIOUS_SHORTCUT,
  normalizePageCycleShortcut,
  normalizePageDigitModifiers,
} from "../../lib/settings/pageShortcuts";
import type { IslandSettings } from "../../lib/settings/types";
import { listPlugins } from "../../features/plugins/api";
import { pluginShortcutRows, type PluginShortcutRow } from "../../features/plugins/pluginShortcuts";
import { useLocale, useTranslation } from "../../i18n";
import { findShortcutOwner, type ShortcutOwner } from "./shortcutConflicts";
import { shortcutOwnerSnapshot, subscribeShortcutOwners } from "./shortcutOwnerStore";

export function useShortcutOwners(settings: IslandSettings) {
  const t = useTranslation();
  const { locale } = useLocale();
  const [pluginRows, setPluginRows] = useState<PluginShortcutRow[]>([]);
  const reported = useSyncExternalStore(subscribeShortcutOwners, shortcutOwnerSnapshot);

  const refreshPlugins = useCallback(() => {
    listPlugins()
      .then((snapshot) => setPluginRows(pluginShortcutRows(snapshot.plugins)))
      .catch((error: unknown) => console.error("Failed to list plugins", error));
  }, []);
  useEffect(() => {
    refreshPlugins();
    window.addEventListener("focus", refreshPlugins);
    return () => window.removeEventListener("focus", refreshPlugins);
  }, [refreshPlugins]);

  const digitModifiers = normalizePageDigitModifiers(settings.pageDigitModifiers);
  const owners: ShortcutOwner[] = [
    ...reported.owners,
    ...pluginRows.flatMap((row) => row.shortcut
      ? [{ id: row.key, label: `${row.title[locale]} · ${row.pluginName[locale]}`, shortcut: row.shortcut, home: "plugins" as const }]
      : []),
    { id: "next", label: t.settings.pageShortcuts.nextPage, shortcut: normalizePageCycleShortcut(settings.pageNextShortcut, DEFAULT_PAGE_NEXT_SHORTCUT), home: "shortcutsIsland" },
    { id: "previous", label: t.settings.pageShortcuts.previousPage, shortcut: normalizePageCycleShortcut(settings.pagePreviousShortcut, DEFAULT_PAGE_PREVIOUS_SHORTCUT), home: "shortcutsIsland" },
    ...Array.from({ length: 9 }, (_, index) => ({
      id: "digit", label: t.settings.pageShortcuts.digitModifiers, shortcut: `${digitModifiers}+${index + 1}`, home: "shortcutsIsland" as const,
    })),
  ];
  const takenBy = (shortcut: string, selfId: string) => findShortcutOwner(shortcut, owners, selfId);

  return { owners, finderOnly: reported.finderOnly, takenBy, refreshPlugins };
}
