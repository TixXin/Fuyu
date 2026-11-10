import { useEffect, useMemo, useState } from "react";
import { resolveThemeColors } from "./themeMode";
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
 * The settings with the colours of the set the mode uses (C31, C33.3). The colour fields are only
 * a copy of that set, so settings saved from these keep both sets as they were.
 */
export function useResolvedTheme(stored: IslandSettings) {
  const systemDark = useSystemDark();
  return useMemo(() => resolveThemeColors(stored, systemDark), [stored, systemDark]);
}
