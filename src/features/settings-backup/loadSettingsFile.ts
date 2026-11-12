import { readSettingsFile } from "./api";
import { fileKeys, fingerprint, settingsToApply } from "./settingsFile.ts";
import { readSettingsFileSynced, restoreBackup, saveSettingsFileSynced } from "./storage.ts";

/** A window still opens if the native side does not answer (outside Tauri, say). */
const READ_TIMEOUT_MS = 1_500;

/**
 * Run by every window before it renders: settings changed in settings.json (by hand, or brought
 * from another folder) go into localStorage first, so the window opens with them. Windows doing
 * this at once write the same values. Never throws.
 */
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
