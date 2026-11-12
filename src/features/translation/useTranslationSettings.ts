import { useEffect, useState } from "react";
import { STORAGE_KEY, loadSettings, saveTranslationSettings, type TranslationSettings } from "./storage";

export function useTranslationSettings() {
  const [settings, setSettings] = useState<TranslationSettings>(loadSettings);

  useEffect(() => { saveTranslationSettings(settings); }, [settings]);

  useEffect(() => {
    const syncFromOtherWindow = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setSettings(loadSettings());
    };
    window.addEventListener("storage", syncFromOtherWindow);
    return () => window.removeEventListener("storage", syncFromOtherWindow);
  }, []);

  return [settings, setSettings] as const;
}
