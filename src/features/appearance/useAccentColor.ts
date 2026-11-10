import { useEffect, useState } from "react";
import { getWindowsAccentColor } from "./api";
import type { IslandSettings } from "./types";

// Windows has no event the page can hear for an accent change; asking now and then is enough.
const WINDOWS_ACCENT_RECHECK_MS = 60_000;

/**
 * The accent the island uses (C33.5): null for the one it ships with (and the light island's
 * own, tokens.css), the picked colour, or Windows' accent, asked again every minute and whenever
 * the window comes back into view.
 */
export function useAccentColor(settings: Pick<IslandSettings, "accentMode" | "accentColor">) {
  const [windowsAccent, setWindowsAccent] = useState<string | null>(null);
  const followsWindows = settings.accentMode === "windows";

  useEffect(() => {
    if (!followsWindows) return;
    let cancelled = false;
    const read = () => {
      void getWindowsAccentColor()
        .then((color) => {
          if (!cancelled) setWindowsAccent(color);
        })
        .catch((error: unknown) => console.error("Failed to read the Windows accent colour", error));
    };
    read();
    const timer = window.setInterval(read, WINDOWS_ACCENT_RECHECK_MS);
    document.addEventListener("visibilitychange", read);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", read);
    };
  }, [followsWindows]);

  if (settings.accentMode === "pick") return settings.accentColor;
  return followsWindows ? windowsAccent : null;
}
