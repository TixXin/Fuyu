import { useEffect, useState } from "react";
import { getWindowsAccentColor } from "./api";
import type { IslandSettings } from "./types";

const WINDOWS_ACCENT_RECHECK_MS = 60_000;

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
