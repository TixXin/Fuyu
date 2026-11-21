import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SETTINGS } from "../../src/lib/settings/settings.ts";
import {
  AGENT_LIGHT_JELLYFISH_MIGRATION_KEY,
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

const earlierDone = [[COLLAPSED_TEXT_DEFAULT_MIGRATION_KEY, "1"], [GLASS_BACKDROP_DEFAULT_MIGRATION_KEY, "1"]];

test("new installs default to the jellyfish light and skip the migration", () => {
  assert.equal(DEFAULT_SETTINGS.agentLightStyle, "mark");
  withStorage([], (values) => {
    assert.equal(loadSettings().agentLightStyle, "mark");
    assert.equal(values.get(AGENT_LIGHT_JELLYFISH_MIGRATION_KEY), "1");
  });
});

test("a stored dot light moves to the jellyfish once", () => {
  withStorage([...earlierDone, [STORAGE_KEY, JSON.stringify({ agentLightStyle: "dot", opacity: 70 })]], (values) => {
    const migrated = loadSettings();
    assert.equal(migrated.agentLightStyle, "mark");
    assert.equal(migrated.opacity, 70);
    assert.equal(JSON.parse(values.get(STORAGE_KEY)).agentLightStyle, "mark");
    assert.equal(values.get(AGENT_LIGHT_JELLYFISH_MIGRATION_KEY), "1");
  });
});

test("a dot picked after the migration is kept", () => {
  const stored = JSON.stringify({ agentLightStyle: "dot" });
  withStorage([...earlierDone, [AGENT_LIGHT_JELLYFISH_MIGRATION_KEY, "1"], [STORAGE_KEY, stored]], (values, writes) => {
    assert.equal(loadSettings().agentLightStyle, "dot");
    assert.equal(values.get(STORAGE_KEY), stored);
    assert.deepEqual(writes, []);
  });
});

test("settings saved without a light style read as the jellyfish", () => {
  withStorage([...earlierDone, [AGENT_LIGHT_JELLYFISH_MIGRATION_KEY, "1"], [STORAGE_KEY, JSON.stringify({ opacity: 70 })]], () => {
    assert.equal(loadSettings().agentLightStyle, "mark");
  });
});
