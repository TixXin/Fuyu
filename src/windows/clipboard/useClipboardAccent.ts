import { useEffect, useState } from "react";
import { getWindowsAccentColor } from "../../lib/settings/api";
import { STORAGE_KEY, loadSettings } from "../../lib/settings/storage";
import type { IslandSettings } from "../../lib/settings/types";
import { useWindowAccent } from "../../lib/theme/useWindowAccent";
import { afterPaint } from "./afterPaint";

type AccentSettings = Pick<IslandSettings, "accentMode" | "accentColor">;

const storedAccent = (): AccentSettings => {
  const { accentMode, accentColor } = loadSettings();
  return { accentMode, accentColor };
};

export function useClipboardAccent(openCount: number) {
  const [stored, setStored] = useState(storedAccent);
  const [windowsAccent, setWindowsAccent] = useState("");
  const followsWindows = stored.accentMode === "windows";

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setStored(storedAccent());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    if (!followsWindows) return;
    let cancelled = false;
    const stop = afterPaint(() => {
      void getWindowsAccentColor()
        .then((color) => {
          if (!cancelled) setWindowsAccent(color ?? "");
        })
        .catch((error: unknown) => console.error("Failed to read the Windows accent colour", error));
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [followsWindows, openCount]);

  useWindowAccent(followsWindows ? { accentMode: "pick", accentColor: windowsAccent } : stored);
}
