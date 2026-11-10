import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPickedColors, resolveThemeColors } from "./themeMode";
import type { IslandSettings } from "./types";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Whether Windows is set to dark mode for apps, following changes. */
export function useSystemDark() {
  const [dark, setDark] = useState(() => window.matchMedia(DARK_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const update = () => setDark(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return dark;
}

/**
 * The settings with the theme mode's colours applied (C31), and a setter that saves changes made
 * from them without overwriting the colours picked by hand.
 */
export function useResolvedTheme(stored: IslandSettings, save: (settings: IslandSettings) => void) {
  const systemDark = useSystemDark();
  const settings = useMemo(() => resolveThemeColors(stored, systemDark), [stored, systemDark]);
  const setSettings = useCallback((next: IslandSettings) => save(keepPickedColors(next, stored)), [save, stored]);
  return [settings, setSettings] as const;
}
