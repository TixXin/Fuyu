import { useEffect, useState } from "react";
import { STORAGE_KEY, loadSettings } from "./storage";
import { activeTone } from "./themeMode";
import { useSystemDark } from "./useResolvedTheme";

export function useWindowLight() {
  const systemDark = useSystemDark();
  const [themeMode, setThemeMode] = useState(() => loadSettings().themeMode);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setThemeMode(loadSettings().themeMode);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return activeTone(themeMode, systemDark) === "light";
}
