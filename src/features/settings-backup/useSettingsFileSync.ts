import { useEffect } from "react";
import { readString } from "../../lib/storage.ts";
import { writeSettingsFile } from "./api";
import { currentKeys, fingerprint, settingsFileText } from "./settingsFile.ts";
import { readSettingsFileSynced, saveSettingsFileSynced } from "./storage.ts";

const CHECK_MS = 2_000;

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
