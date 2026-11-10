import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_PAGE_NEXT_SHORTCUT,
  DEFAULT_PAGE_PREVIOUS_SHORTCUT,
  normalizePageCycleShortcut,
  normalizePageDigitModifiers,
} from "../../features/appearance/pageShortcuts";
import type { IslandSettings } from "../../features/appearance/types";
import type { ClipboardHistorySettings } from "../../features/clipboard/api";
import { normalizeClipboardShortcut } from "../../features/clipboard/shortcut";
import { listPlugins } from "../../features/plugins/api";
import { pluginShortcutRows, type PluginShortcutRow } from "../../features/plugins/pluginShortcuts";
import type { TranslationSettings } from "../../features/translation/storage";
import { useLocale, useTranslation } from "../../i18n";
import { findShortcutOwner, type ShortcutOwner } from "./shortcutConflicts";

/**
 * Every shortcut the island has registered or listens for, each with the page it is set on, so
 * a recorder refuses the same keys whichever page it is on (the Shortcuts page or a feature's
 * own). The translation and clipboard settings come from the page, which holds the one copy it
 * edits: a second copy in the same window would not see the page's changes.
 */
export function useShortcutOwners({ settings, clipboard, translation }: {
  settings: IslandSettings;
  clipboard: ClipboardHistorySettings;
  translation: TranslationSettings;
}) {
  const t = useTranslation();
  const { locale } = useLocale();
  const [pluginRows, setPluginRows] = useState<PluginShortcutRow[]>([]);

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

  // A global hotkey swallows its keys everywhere, so it may not reuse another global
  // shortcut or the island's page keys.
  const digitModifiers = normalizePageDigitModifiers(settings.pageDigitModifiers);
  const owners: ShortcutOwner[] = [
    ...(settings.translationEnabled ? [
      { id: "window", label: t.settings.shortcuts.openTranslation, shortcut: translation.shortcut, home: "translation" as const },
      { id: "selection", label: t.settings.translation.selectionShortcut, shortcut: translation.selectionShortcut, home: "translation" as const },
    ] : []),
    ...(clipboard.enabled && clipboard.shortcutEnabled
      ? [{ id: "clipboard", label: t.settings.clipboard.shortcut, shortcut: normalizeClipboardShortcut(clipboard.shortcut), home: "clipboard" as const }]
      : []),
    ...pluginRows.flatMap((row) => row.shortcut
      ? [{ id: row.key, label: `${row.title[locale]} · ${row.pluginName[locale]}`, shortcut: row.shortcut, home: "plugins" as const }]
      : []),
    { id: "next", label: t.settings.pageShortcuts.nextPage, shortcut: normalizePageCycleShortcut(settings.pageNextShortcut, DEFAULT_PAGE_NEXT_SHORTCUT), home: "behavior" },
    { id: "previous", label: t.settings.pageShortcuts.previousPage, shortcut: normalizePageCycleShortcut(settings.pagePreviousShortcut, DEFAULT_PAGE_PREVIOUS_SHORTCUT), home: "behavior" },
    ...Array.from({ length: 9 }, (_, index) => ({
      id: "digit", label: t.settings.pageShortcuts.digitModifiers, shortcut: `${digitModifiers}+${index + 1}`, home: "behavior" as const,
    })),
  ];
  const takenBy = (shortcut: string, selfId: string) => findShortcutOwner(shortcut, owners, selfId);

  return { owners, takenBy, refreshPlugins };
}
