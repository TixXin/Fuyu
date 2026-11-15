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
import { SHORTCUT_ACTIONS, type ScreenshotSettings } from "../../features/screenshot/settings";
import { loadScreenshotSettings } from "../../features/screenshot/storage";
import type { TranslationSettings } from "../../features/translation/storage";
import type { VoiceInputSettings } from "../../features/voice-input/settings";
import { loadVoiceInputSettings } from "../../features/voice-input/storage";
import { useLocale, useTranslation } from "../../i18n";
import { findShortcutOwner, type ShortcutOwner } from "./shortcutConflicts";

export function useShortcutOwners({ settings, clipboard, translation, screenshot, voice }: {
  settings: IslandSettings;
  clipboard: ClipboardHistorySettings;
  translation: TranslationSettings;
  screenshot?: ScreenshotSettings;
  voice?: VoiceInputSettings;
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

  const digitModifiers = normalizePageDigitModifiers(settings.pageDigitModifiers);
  const voiceInput = voice ?? loadVoiceInputSettings();
  const owners: ShortcutOwner[] = [
    ...(settings.translationEnabled ? [
      { id: "window", label: t.settings.shortcuts.openTranslation, shortcut: translation.shortcut, home: "translation" as const },
      { id: "selection", label: t.settings.translation.selectionShortcut, shortcut: translation.selectionShortcut, home: "translation" as const },
    ] : []),
    ...(clipboard.enabled && clipboard.shortcutEnabled
      ? [{ id: "clipboard", label: t.settings.clipboard.shortcut, shortcut: normalizeClipboardShortcut(clipboard.shortcut), home: "clipboard" as const }]
      : []),
    ...(settings.screenshotEnabled
      ? SHORTCUT_ACTIONS.flatMap((action) => {
        const shortcut = (screenshot ?? loadScreenshotSettings()).shortcuts[action];
        return shortcut ? [{ id: `screenshot:${action}`, label: t.settings.screenshot.actions[action], shortcut, home: "screenshot" as const }] : [];
      })
      : []),
    ...(voiceInput.enabled && voiceInput.shortcut
      ? [{ id: "voiceInput", label: t.voiceInput.settings.shortcut, shortcut: voiceInput.shortcut, home: "voiceInput" as const }]
      : []),
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

  return { owners, takenBy, refreshPlugins };
}
