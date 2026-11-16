import { useEffect, useState } from "react";
import { isSameSettings } from "./settings";
import { STORAGE_KEY, loadSettings, saveSettings } from "./storage";
import type { IslandSettings } from "./types";

export function useIslandSettings() {
  const [settings, setSettings] = useState<IslandSettings>(loadSettings);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    const syncFromSettingsWindow = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        const nextSettings = loadSettings();
        setSettings((current) =>
          isSameSettings(current, nextSettings) ? current : nextSettings,
        );
      }
    };

    window.addEventListener("storage", syncFromSettingsWindow);
    return () => window.removeEventListener("storage", syncFromSettingsWindow);
  }, []);

  return [settings, setSettings] as const;
}
