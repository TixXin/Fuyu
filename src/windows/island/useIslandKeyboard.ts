import { useEffect } from "react";
import { pageCycleDirection, pageDigitFromEvent } from "../../lib/settings/pageShortcuts";
import { cycleShortcutPage, pageForAltDigit, type IslandFeatures } from "./features";
import type { IslandMode, IslandPage } from "./types";
import { isPanelEditing, stopPanelEditing } from "./custom-panels/panelEditing";

export function useIslandKeyboard(
  onCollapse: () => void,
  mode: IslandMode,
  features: IslandFeatures,
  page: IslandPage,
  onPageChange: (page: IslandPage) => void,
  pageDigitModifiers: string,
  pageNextShortcut: string,
  pagePreviousShortcut: string,
) {
  useEffect(() => {
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

      if (event.key === "Escape") {
        if (isPanelEditing()) stopPanelEditing();
        else onCollapse();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    features,
    mode,
    onCollapse,
    onPageChange,
    page,
    pageDigitModifiers,
    pageNextShortcut,
    pagePreviousShortcut,
  ]);
}
