import { readSettingsFile } from "./api";
import { fileKeys, fingerprint, settingsToApply } from "./settingsFile.ts";
import { readSettingsFileSynced, restoreBackup, saveSettingsFileSynced } from "./storage.ts";

const READ_TIMEOUT_MS = 1_500;

export async function loadSettingsFile() {
  try {
    const text = await Promise.race([
      readSettingsFile(),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), READ_TIMEOUT_MS)),
    ]);
    const file = fileKeys(text);
    const apply = settingsToApply(file, readSettingsFileSynced());
    if (!apply) return;
    restoreBackup(apply);
    saveSettingsFileSynced(fingerprint(apply));
  } catch (error) {
    console.error("Failed to read settings.json", error);
  }
}
