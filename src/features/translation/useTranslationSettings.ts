import { useEffect, useRef, useState } from "react";
import { STORAGE_KEY, loadSettings, saveTranslationSettings, type TranslationSettings } from "./storage";

const CHANGED_HERE = "fuyu-translation-settings-changed";

export function useTranslationSettings() {
  const [settings, setSettings] = useState<TranslationSettings>(loadSettings);
  const self = useRef({});

  useEffect(() => {
    saveTranslationSettings(settings);
    window.dispatchEvent(new CustomEvent(CHANGED_HERE, { detail: self.current }));
  }, [settings]);

  useEffect(() => {
    const reload = () => {
      const stored = loadSettings();
      setSettings((current) => (JSON.stringify(current) === JSON.stringify(stored) ? current : stored));
    };
    const syncFromOtherWindow = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) reload();
    };
    const syncFromThisWindow = (event: Event) => {
      if ((event as CustomEvent).detail !== self.current) reload();
    };
    window.addEventListener("storage", syncFromOtherWindow);
    window.addEventListener(CHANGED_HERE, syncFromThisWindow);
    return () => {
      window.removeEventListener("storage", syncFromOtherWindow);
      window.removeEventListener(CHANGED_HERE, syncFromThisWindow);
    };
  }, []);

  return [settings, setSettings] as const;
}
