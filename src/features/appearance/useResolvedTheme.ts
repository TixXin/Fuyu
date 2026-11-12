import { useEffect, useMemo, useState } from "react";
import { resolveThemeColors } from "./themeMode";
import type { IslandSettings } from "./types";

const DARK_QUERY = "(prefers-color-scheme: dark)";

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

export function useResolvedTheme(stored: IslandSettings) {
  const systemDark = useSystemDark();
  return useMemo(() => resolveThemeColors(stored, systemDark), [stored, systemDark]);
}
