import { useEffect } from "react";
import { hideTranslationWindow, setTranslationSelectionShortcut, setTranslationShortcut, setTranslationTarget } from "./api";
import { loadSettings } from "./storage";

export function useTranslationEnabled(enabled: boolean, inIsland: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const settings = loadSettings();
    void Promise.all([
      setTranslationTarget(inIsland).then(() => (inIsland ? hideTranslationWindow() : undefined)),
      setTranslationShortcut(settings.shortcut),
      setTranslationSelectionShortcut(settings.selectionShortcut),
    ]).catch((error) => {
      console.error("Failed to switch quick translation", error);
    });
  }, [enabled, inIsland]);
}
