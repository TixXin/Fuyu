import assert from "node:assert/strict";
import test from "node:test";
import { copyRenamedKeys, renamedKey } from "../../src/lib/renamedKeys.ts";

/** A Storage with the parts copyRenamedKeys uses. */
function memoryStorage(entries, { full = false } = {}) {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem(key, value) {
      if (full) throw new Error("QuotaExceededError");
      map.set(key, String(value));
    },
    entries: () => Object.fromEntries(map),
  };
}

test("keys from before the rename get their new names", () => {
  assert.equal(renamedKey("focusd-island-settings"), "fuyu-settings");
  assert.equal(renamedKey("focusd-island-todos-migrated-v1"), "fuyu-todos-migrated-v1");
  assert.equal(renamedKey("fuyu-settings"), null);
  assert.equal(renamedKey("something-else"), null);
});

test("old keys are copied, new keys win, and the old ones stay", () => {
  const storage = memoryStorage({
    "focusd-island-settings": '{"theme":"old"}',
    "focusd-island-locale": "en",
    "fuyu-locale": "zh-CN",
    "other-app": "x",
  });
  assert.equal(copyRenamedKeys(storage), 1);
  assert.deepEqual(storage.entries(), {
    "focusd-island-settings": '{"theme":"old"}',
    "focusd-island-locale": "en",
    "fuyu-locale": "zh-CN",
    "other-app": "x",
    "fuyu-settings": '{"theme":"old"}',
  });
  // A second start copies nothing, even after the old version wrote again.
  storage.setItem("focusd-island-settings", '{"theme":"newer in the old version"}');
  assert.equal(copyRenamedKeys(storage), 0);
  assert.equal(storage.getItem("fuyu-settings"), '{"theme":"old"}');
});

test("full or blocked storage does not stop the island from starting", () => {
  assert.equal(copyRenamedKeys(memoryStorage({ "focusd-island-settings": "{}" }, { full: true })), 0);
  const blocked = {
    get length() {
      throw new Error("SecurityError");
    },
  };
  assert.equal(copyRenamedKeys(blocked), 0);
});
