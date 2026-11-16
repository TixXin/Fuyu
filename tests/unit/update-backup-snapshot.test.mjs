import assert from "node:assert/strict";
import test from "node:test";
import { applySnapshot, settingsUnreadable, takeSnapshot } from "../../src/lib/settings-backup/localSnapshot.ts";

function memoryStorage(entries) {
  const map = new Map(Object.entries(entries));
  return {
    get length() { return map.size; },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); },
    removeItem: (key) => { map.delete(key); },
    entries: () => Object.fromEntries(map),
  };
}

test("the snapshot holds every fuyu key except one-shot requests", () => {
  const storage = memoryStorage({
    "fuyu-settings": "{}",
    "fuyu-timers": "[]",
    "fuyu-settings-focus": "{\"section\":\"data\"}",
    "focusd-island-settings": "{}",
    "other": "x",
  });
  assert.deepEqual(takeSnapshot(storage), { "fuyu-settings": "{}", "fuyu-timers": "[]" });
});

test("applying a snapshot restores it and drops keys added since", () => {
  const storage = memoryStorage({
    "fuyu-settings": "{\"new\":true}",
    "fuyu-added-later": "1",
    "fuyu-settings-focus": "keep",
    "other": "keep",
  });
  const written = applySnapshot(storage, { "fuyu-settings": "{}", "fuyu-locale": "en", "fuyu-panel-preview": "no" });
  assert.equal(written, 2);
  assert.deepEqual(storage.entries(), {
    "fuyu-settings": "{}",
    "fuyu-settings-focus": "keep",
    "other": "keep",
    "fuyu-locale": "en",
  });
});

test("settings that are not a JSON object count as unreadable", () => {
  assert.equal(settingsUnreadable(null), false);
  assert.equal(settingsUnreadable("{\"opacity\":95}"), false);
  assert.equal(settingsUnreadable("{broken"), true);
  assert.equal(settingsUnreadable("[]"), true);
  assert.equal(settingsUnreadable("null"), true);
});
