import { BACKUP_KEYS, buildBackup, parseBackup, type BackupKey } from "./backup.ts";

export type SettingsKeys = Partial<Record<BackupKey, string>>;

export function fingerprint(keys: SettingsKeys): string {
  const text = JSON.stringify(BACKUP_KEYS.filter((key) => keys[key] !== undefined).map((key) => [key, keys[key]]));
  let hash = 0x811c9dc5;
  for (let at = 0; at < text.length; at += 1) {
    hash ^= text.charCodeAt(at);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(16)}:${text.length}`;
}

export function currentKeys(read: (key: BackupKey) => string | null): SettingsKeys {
  return buildBackup(read, new Date(0)).keys;
}

export function settingsFileText(keys: SettingsKeys, now: Date): string {
  return `${JSON.stringify({ app: "fuyu", version: 1, exportedAt: now.toISOString(), keys }, null, 2)}\n`;
}

export function fileKeys(text: string | null): SettingsKeys | null {
  if (text === null) return null;
  const parsed = parseBackup(text);
  if ("keys" in parsed) return parsed.keys;
  return parsed.problem === "empty" ? {} : null;
}

export function settingsToApply(file: SettingsKeys | null, synced: string | null): SettingsKeys | null {
  if (file === null) return null;
  return fingerprint(file) === synced ? null : file;
}
