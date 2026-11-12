// settings.json in the island's data folder (#50, D30.2): the settings of BACKUP_KEYS as a file,
// in the backup format. localStorage stays where pages read and write them; this decides when the
// file and localStorage are copied one way or the other. Pure, so tests/unit can load it.
import { BACKUP_KEYS, buildBackup, parseBackup, type BackupKey } from "./backup.ts";

export type SettingsKeys = Partial<Record<BackupKey, string>>;

/** A short fingerprint of the settings, the same for the same values in any order. */
export function fingerprint(keys: SettingsKeys): string {
  const text = JSON.stringify(BACKUP_KEYS.filter((key) => keys[key] !== undefined).map((key) => [key, keys[key]]));
  let hash = 0x811c9dc5;
  for (let at = 0; at < text.length; at += 1) {
    hash ^= text.charCodeAt(at);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(16)}:${text.length}`;
}

/** The settings localStorage holds now. */
export function currentKeys(read: (key: BackupKey) => string | null): SettingsKeys {
  return buildBackup(read, new Date(0)).keys;
}

/** The file's text for these settings. */
export function settingsFileText(keys: SettingsKeys, now: Date): string {
  return `${JSON.stringify({ app: "fuyu", version: 1, exportedAt: now.toISOString(), keys }, null, 2)}\n`;
}

/** The settings in the file's text: null for no file, or one that is not a settings file. */
export function fileKeys(text: string | null): SettingsKeys | null {
  if (text === null) return null;
  const parsed = parseBackup(text);
  if ("keys" in parsed) return parsed.keys;
  return parsed.problem === "empty" ? {} : null;
}

/**
 * At start: whether the file's settings go into localStorage. They do when the file differs from
 * what was last copied either way (`synced`): it was changed or brought from elsewhere. When it is
 * the same, localStorage is newer or equal, also after an older version changed it, and wins.
 */
export function settingsToApply(file: SettingsKeys | null, synced: string | null): SettingsKeys | null {
  if (file === null) return null;
  return fingerprint(file) === synced ? null : file;
}
