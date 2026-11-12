import assert from "node:assert/strict";
import test from "node:test";
import { currentKeys, fileKeys, fingerprint, settingsFileText, settingsToApply } from "../../src/features/settings-backup/settingsFile.ts";

const keys = { "fuyu-locale": "en", "fuyu-settings": "{\"opacity\":60}" };

test("the fingerprint follows the values, not their order or other keys", () => {
  const reordered = { "fuyu-settings": "{\"opacity\":60}", "fuyu-locale": "en" };
  assert.equal(fingerprint(keys), fingerprint(reordered));
  assert.notEqual(fingerprint(keys), fingerprint({ ...keys, "fuyu-locale": "zh-CN" }));
  assert.notEqual(fingerprint(keys), fingerprint({ "fuyu-locale": "en" }));
  assert.equal(fingerprint({ ...keys, "fuyu-settings-focus": "x" }), fingerprint(keys), "only settings count");
});

test("only the backup keys are read from localStorage", () => {
  const stored = { ...keys, "fuyu-panel-preview": "{}", "fuyu-settings-file-synced": "abc" };
  assert.deepEqual(currentKeys((key) => stored[key] ?? null), keys);
});

test("the file is a settings backup and reads back the same", () => {
  const text = settingsFileText(keys, new Date("2026-11-12T10:00:00Z"));
  const parsed = JSON.parse(text);
  assert.equal(parsed.app, "fuyu");
  assert.equal(parsed.version, 1);
  assert.deepEqual(fileKeys(text), keys);
  assert.deepEqual(fileKeys(settingsFileText({}, new Date())), {}, "an empty file is still a file");
  assert.equal(fileKeys(null), null);
  assert.equal(fileKeys("{ broken"), null);
});

test("at start the file wins only when it changed since the last copy", () => {
  assert.equal(settingsToApply(null, null), null, "no file yet: localStorage stays");
  assert.deepEqual(settingsToApply(keys, null), keys, "a file never copied (another folder, a new computer) is applied");
  assert.equal(settingsToApply(keys, fingerprint(keys)), null, "unchanged file: localStorage is newer or equal");
  const edited = { ...keys, "fuyu-locale": "zh-CN" };
  assert.deepEqual(settingsToApply(edited, fingerprint(keys)), edited, "a file edited by hand is applied");
});
