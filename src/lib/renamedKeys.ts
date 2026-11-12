const OLD_PREFIX = "focusd-island-";
const NEW_PREFIX = "fuyu-";

export function renamedKey(key: string): string | null {
  return key.startsWith(OLD_PREFIX) ? NEW_PREFIX + key.slice(OLD_PREFIX.length) : null;
}

export function copyRenamedKeys(storage: Storage): number {
  let copied = 0;
  try {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
    for (const key of keys) {
      const target = key === null ? null : renamedKey(key);
      if (key === null || target === null || storage.getItem(target) !== null) continue;
      const value = storage.getItem(key);
      if (value === null) continue;
      try {
        storage.setItem(target, value);
        copied += 1;
      } catch {
      }
    }
  } catch {
  }
  return copied;
}
