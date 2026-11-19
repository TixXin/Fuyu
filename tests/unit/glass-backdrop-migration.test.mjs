import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SETTINGS } from "../../src/lib/settings/settings.ts";
import {
  COLLAPSED_TEXT_DEFAULT_MIGRATION_KEY,
  GLASS_BACKDROP_DEFAULT_MIGRATION_KEY,
  STORAGE_KEY,
  loadSettings,
} from "../../src/lib/settings/storage.ts";

function withStorage(entries, run) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map(entries);
  const writes = [];
  const localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      writes.push(key);
      values.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage, crypto: globalThis.crypto } });
  try {
    run(values, writes);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
    else delete globalThis.window;
  }
}

const doneCollapsed = [COLLAPSED_TEXT_DEFAULT_MIGRATION_KEY, "1"];

test("new installs default to live windows behind the glass and skip the migration", () => {
  assert.equal(DEFAULT_SETTINGS.glassBackdrop, "native");
  withStorage([], (values) => {
    assert.equal(loadSettings().glassBackdrop, "native");
    assert.equal(values.get(GLASS_BACKDROP_DEFAULT_MIGRATION_KEY), "1");
  });
});

test("a stored wallpaper backdrop moves to live windows once", () => {
  withStorage([doneCollapsed, [STORAGE_KEY, JSON.stringify({ glassBackdrop: "wallpaper", opacity: 70 })]], (values) => {
    const migrated = loadSettings();
    assert.equal(migrated.glassBackdrop, "native");
    assert.equal(migrated.opacity, 70);
    assert.equal(JSON.parse(values.get(STORAGE_KEY)).glassBackdrop, "native");
    assert.equal(values.get(GLASS_BACKDROP_DEFAULT_MIGRATION_KEY), "1");
  });
});

test("wallpaper picked after the migration is kept", () => {
  const stored = JSON.stringify({ glassBackdrop: "wallpaper" });
  withStorage([doneCollapsed, [GLASS_BACKDROP_DEFAULT_MIGRATION_KEY, "1"], [STORAGE_KEY, stored]], (values, writes) => {
    assert.equal(loadSettings().glassBackdrop, "wallpaper");
    assert.equal(values.get(STORAGE_KEY), stored);
    assert.deepEqual(writes, []);
  });
});

test("other backdrops only get the marker, not a settings rewrite", () => {
  for (const glassBackdrop of ["none", "native"]) {
    const stored = JSON.stringify({ glassBackdrop });
    withStorage([doneCollapsed, [STORAGE_KEY, stored]], (values, writes) => {
      assert.equal(loadSettings().glassBackdrop, glassBackdrop);
      assert.deepEqual(writes, [GLASS_BACKDROP_DEFAULT_MIGRATION_KEY]);
      assert.equal(values.get(STORAGE_KEY), stored);
    });
  }
});

test("both one-time migrations run together on an old settings blob", () => {
  withStorage([[STORAGE_KEY, JSON.stringify({ showCollapsedText: false, glassBackdrop: "wallpaper" })]], (values) => {
    const migrated = loadSettings();
    assert.equal(migrated.showCollapsedText, true);
    assert.equal(migrated.glassBackdrop, "native");
    assert.equal(values.get(COLLAPSED_TEXT_DEFAULT_MIGRATION_KEY), "1");
    assert.equal(values.get(GLASS_BACKDROP_DEFAULT_MIGRATION_KEY), "1");
  });
});
