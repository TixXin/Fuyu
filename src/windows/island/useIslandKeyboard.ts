import { useEffect } from "react";
import { pageCycleDirection, pageDigitFromEvent } from "../../lib/settings/pageShortcuts";
import { isPrimaryKey, PRIMARY_KEY } from "../../lib/shortcut/shortcut";
import { isMacOS } from "../../lib/platform";
import { cycleShortcutPage, pageForAltDigit, type IslandFeatures } from "./features";
import type { IslandMode, IslandPage } from "./types";
import { isPanelEditing, stopPanelEditing } from "./custom-panels/panelEditing";
import { escapeClosesPanel, OPEN_OVERLAY_TARGET } from "./pageArrows";

export const OPEN_SETTINGS_SHORTCUT = isMacOS ? `${PRIMARY_KEY},` : `${PRIMARY_KEY}+,`;

export function isOpenSettingsShortcut(event: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey">, mac = isMacOS) {
  return event.key === "," && !event.altKey && !event.shiftKey && isPrimaryKey(event, mac);
}

export function useIslandKeyboard(
  onCollapse: () => void,
  onOpenSettings: () => void,
  mode: IslandMode,
  features: IslandFeatures,
  page: IslandPage,
  onPageChange: (page: IslandPage) => void,
  pageDigitModifiers: string,
  pageNextShortcut: string,
  pagePreviousShortcut: string,
) {
  useEffect(() => {
    let overlayOpenAtEscape = false;
    const noteOverlay = (event: KeyboardEvent) => {
      if (event.key === "Escape") overlayOpenAtEscape = document.querySelector(OPEN_OVERLAY_TARGET) !== null;
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const digit = pageDigitFromEvent(event, pageDigitModifiers);
      if (digit !== null && mode === "expanded") {
        const target = pageForAltDigit(features, digit);
        if (target) {
          event.preventDefault();
          if (target !== page) onPageChange(target);
        }
        return;
      }

      const direction = pageCycleDirection(event, pageNextShortcut, pagePreviousShortcut);
      if (direction !== null && mode === "expanded") {
        event.preventDefault();
        const target = cycleShortcutPage(features, page, direction);
        if (target) onPageChange(target);
        return;
      }

      if (mode === "expanded" && isOpenSettingsShortcut(event)) {
        event.preventDefault();
        onOpenSettings();
        return;
      }

      if (event.key === "Escape") {
        if (isPanelEditing()) stopPanelEditing();
        else if (escapeClosesPanel(event, overlayOpenAtEscape)) onCollapse();
      }
    };

    window.addEventListener("keydown", noteOverlay, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", noteOverlay, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    features,
    mode,
    onCollapse,
    onOpenSettings,
    onPageChange,
    page,
    pageDigitModifiers,
    pageNextShortcut,
    pagePreviousShortcut,
  ]);
}
