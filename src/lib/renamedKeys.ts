// localStorage keys from before the rename (D17): `focusd-island-*` became `fuyu-*`.
// main.tsx copies them first thing, before any module reads its settings.

const OLD_PREFIX = "focusd-island-";
const NEW_PREFIX = "fuyu-";

/** The key a stored key has now, or null when it is not one from before the rename. */
export function renamedKey(key: string): string | null {
  return key.startsWith(OLD_PREFIX) ? NEW_PREFIX + key.slice(OLD_PREFIX.length) : null;
}

/**
 * Copies every `focusd-island-*` key to its `fuyu-*` name, unless that one is
 * set already. The old keys stay, so an older version started again still
 * finds its data. Never throws: storage may be blocked or full.
 */
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
        // Full: the rest are copied on the next start.
      }
    }
  } catch {
    // Storage blocked: the island starts with its defaults, as it would anyway.
  }
  return copied;
}
