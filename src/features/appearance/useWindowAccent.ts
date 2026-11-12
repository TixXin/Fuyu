import { useEffect, useState } from "react";
import { STORAGE_KEY, loadSettings } from "./storage";
import { accentVariables } from "./themeMode";
import type { IslandSettings } from "./types";
import { useAccentColor } from "./useAccentColor";

type AccentSettings = Pick<IslandSettings, "accentMode" | "accentColor">;

const accentOf = ({ accentMode, accentColor }: IslandSettings): AccentSettings => ({ accentMode, accentColor });

export function useWindowAccent(settings?: AccentSettings) {
  const [stored, setStored] = useState(() => accentOf(loadSettings()));
  const reads = settings === undefined;

  useEffect(() => {
    if (!reads) return;
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setStored(accentOf(loadSettings()));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [reads]);

  const accent = useAccentColor(settings ?? stored);

  useEffect(() => {
    const style = document.documentElement.style;
    const variables = accentVariables(accent);
    for (const [name, value] of Object.entries(variables)) style.setProperty(name, value);
    return () => {
      for (const name of Object.keys(variables)) style.removeProperty(name);
    };
  }, [accent]);
}
