import { useEffect } from "react";
import { readString } from "../../lib/storage.ts";
import { writeSettingsFile } from "./api";
import { currentKeys, fingerprint, settingsFileText } from "./settingsFile.ts";
import { readSettingsFileSynced, saveSettingsFileSynced } from "./storage.ts";

/** How often the island looks for settings it changed itself (others' changes come as events). */
const CHECK_MS = 2_000;

/**
 * Keeps settings.json up to date, run by the island window only. Any window may change a setting
 * in any way, so it compares fingerprints rather than hooking the writes: at once when another
 * window changes localStorage, and every two seconds for its own changes. A change missed at quit
 * is written at the next start, as localStorage still differs from what was last copied.
 */
export function useSettingsFileSync() {
  useEffect(() => {
    let writing = false;
    const check = () => {
      if (writing) return;
      const keys = currentKeys(readString);
      const print = fingerprint(keys);
      if (print === readSettingsFileSynced()) return;
      writing = true;
      void writeSettingsFile(settingsFileText(keys, new Date()))
        .then(() => saveSettingsFileSynced(print))
        .catch((error: unknown) => console.error("Failed to write settings.json", error))
        .finally(() => {
          writing = false;
        });
    };
    check();
    const timer = window.setInterval(check, CHECK_MS);
    window.addEventListener("storage", check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", check);
    };
  }, []);
}
