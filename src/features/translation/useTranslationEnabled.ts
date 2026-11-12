import { useEffect } from "react";
import { hideTranslationWindow, setTranslationEnabled, setTranslationSelectionShortcut, setTranslationShortcut, setTranslationTarget } from "./api";
import { loadSettings } from "./storage";

export function useTranslationEnabled(enabled: boolean, inIsland: boolean) {
  useEffect(() => {
    void setTranslationEnabled(enabled)
      .then(() => {
        if (!enabled) return hideTranslationWindow();
        const settings = loadSettings();
        return Promise.all([
          setTranslationTarget(inIsland).then(() => (inIsland ? hideTranslationWindow() : undefined)),
          setTranslationShortcut(settings.shortcut),
          setTranslationSelectionShortcut(settings.selectionShortcut),
        ]);
      })
      .catch((error) => {
        console.error("Failed to switch quick translation", error);
      });
  }, [enabled, inIsland]);
}
