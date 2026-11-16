export const SNAPSHOT_EXCLUDED_KEYS = [
  "fuyu-settings-focus",
  "fuyu-translation-handoff",
  "fuyu-position-reset",
  "fuyu-panel-preview",
  "fuyu-onboarding-demo",
  "fuyu-todo-project-edit",
] as const;

export type StorageLike = {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function isSnapshotKey(key: string) {
  return key.startsWith("fuyu-") && !(SNAPSHOT_EXCLUDED_KEYS as readonly string[]).includes(key);
}

function snapshotKeys(storage: StorageLike) {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key !== null && isSnapshotKey(key)) keys.push(key);
  }
  return keys.sort();
}

export function takeSnapshot(storage: StorageLike): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (const key of snapshotKeys(storage)) {
    const value = storage.getItem(key);
    if (value !== null) snapshot[key] = value;
  }
  return snapshot;
}

export function applySnapshot(storage: StorageLike, snapshot: Record<string, string>) {
  const stale = snapshotKeys(storage).filter((key) => !(key in snapshot));
  for (const key of stale) storage.removeItem(key);
  let written = 0;
  for (const [key, value] of Object.entries(snapshot)) {
    if (!isSnapshotKey(key) || typeof value !== "string") continue;
    storage.setItem(key, value);
    written += 1;
  }
  return written;
}

export function settingsUnreadable(stored: string | null) {
  if (stored === null) return false;
  try {
    const value: unknown = JSON.parse(stored);
    return typeof value !== "object" || value === null || Array.isArray(value);
  } catch {
    return true;
  }
}
