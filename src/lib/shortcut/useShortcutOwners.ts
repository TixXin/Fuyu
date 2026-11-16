import { useSyncExternalStore } from "react";
import {
  DEFAULT_PAGE_NEXT_SHORTCUT,
  DEFAULT_PAGE_PREVIOUS_SHORTCUT,
  normalizePageCycleShortcut,
  normalizePageDigitModifiers,
} from "../settings/pageShortcuts";
import type { IslandSettings } from "../settings/types";
import { useTranslation } from "../../i18n";
import { findShortcutOwner, type ShortcutOwner } from "./conflicts";
import { refreshShortcutOwners, shortcutOwnerSnapshot, subscribeShortcutOwners } from "./ownerStore";

export function useShortcutOwners(settings: IslandSettings) {
  const t = useTranslation();
  const reported = useSyncExternalStore(subscribeShortcutOwners, shortcutOwnerSnapshot);

  const digitModifiers = normalizePageDigitModifiers(settings.pageDigitModifiers);
  const owners: ShortcutOwner[] = [
    ...reported.owners,
    { id: "next", label: t.settings.pageShortcuts.nextPage, shortcut: normalizePageCycleShortcut(settings.pageNextShortcut, DEFAULT_PAGE_NEXT_SHORTCUT), home: "shortcutsIsland" },
    { id: "previous", label: t.settings.pageShortcuts.previousPage, shortcut: normalizePageCycleShortcut(settings.pagePreviousShortcut, DEFAULT_PAGE_PREVIOUS_SHORTCUT), home: "shortcutsIsland" },
    ...Array.from({ length: 9 }, (_, index) => ({
      id: "digit", label: t.settings.pageShortcuts.digitModifiers, shortcut: `${digitModifiers}+${index + 1}`, home: "shortcutsIsland",
    })),
  ];
  const takenBy = (shortcut: string, selfId: string) => findShortcutOwner(shortcut, owners, selfId);

  return { owners, finderOnly: reported.finderOnly, takenBy, refreshPlugins: refreshShortcutOwners };
}
