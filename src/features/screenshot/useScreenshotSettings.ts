import { useEffect, useState } from "react";
import type { ScreenshotSettings } from "./settings";
import { SCREENSHOT_SETTINGS_KEY, loadScreenshotSettings, saveScreenshotSettings } from "./storage";

export function useScreenshotSettings() {
  const [settings, setSettings] = useState<ScreenshotSettings>(loadScreenshotSettings);

  useEffect(() => { saveScreenshotSettings(settings); }, [settings]);

  useEffect(() => {
    const syncFromOtherWindow = (event: StorageEvent) => {
      if (event.key === SCREENSHOT_SETTINGS_KEY) setSettings(loadScreenshotSettings());
    };
    window.addEventListener("storage", syncFromOtherWindow);
    return () => window.removeEventListener("storage", syncFromOtherWindow);
  }, []);

  return [settings, setSettings] as const;
}
