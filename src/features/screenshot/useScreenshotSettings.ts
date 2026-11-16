import { useEffect, useRef, useState } from "react";
import type { ScreenshotSettings } from "./settings";
import { SCREENSHOT_SETTINGS_KEY, loadScreenshotSettings, saveScreenshotSettings } from "./storage";

const CHANGED_HERE = "fuyu-screenshot-settings-changed";

export function useScreenshotSettings() {
  const [settings, setSettings] = useState<ScreenshotSettings>(loadScreenshotSettings);
  const self = useRef({});

  useEffect(() => {
    saveScreenshotSettings(settings);
    window.dispatchEvent(new CustomEvent(CHANGED_HERE, { detail: self.current }));
  }, [settings]);

  useEffect(() => {
    const reload = () => {
      const stored = loadScreenshotSettings();
      setSettings((current) => (JSON.stringify(current) === JSON.stringify(stored) ? current : stored));
    };
    const syncFromOtherWindow = (event: StorageEvent) => {
      if (event.key === SCREENSHOT_SETTINGS_KEY) reload();
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
