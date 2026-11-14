import { useEffect, useState } from "react";
import { STORAGE_KEY, loadSettings } from "./storage";
import { surfaceTone } from "./themeMode";
import { useSystemDark } from "./useResolvedTheme";

export function useWindowLight() {
  const systemDark = useSystemDark();
  const [settings, setSettings] = useState(loadSettings);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setSettings(loadSettings());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return surfaceTone(settings, systemDark, "windows") === "light";
}
