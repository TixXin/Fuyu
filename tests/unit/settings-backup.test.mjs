import assert from "node:assert/strict";
import test from "node:test";
import { BACKUP_KEYS, backupFileName, buildBackup, parseBackup } from "../../src/features/settings-backup/backup.ts";

test("a backup holds the set settings keys and nothing else", () => {
  const stored = {
    "fuyu-settings": '{"opacity":95}',
    "fuyu-locale": "en",
    "fuyu-todos": "[secret todo]",
    "fuyu-position": '{"x":1,"y":2}',
  };
  const backup = buildBackup((key) => stored[key] ?? null, new Date("2026-11-06T06:30:00Z"));
  assert.deepEqual(backup, {
    app: "fuyu",
    version: 1,
    exportedAt: "2026-11-06T06:30:00.000Z",
    keys: { "fuyu-settings": '{"opacity":95}', "fuyu-locale": "en" },
  });
  // Todos, window positions, migration markers and one-off requests are never in a backup.
  for (const key of ["fuyu-todos", "fuyu-position", "fuyu-todos-migrated-v1", "fuyu-settings-focus"]) {
    assert.ok(!BACKUP_KEYS.includes(key), key);
  }
});

test("a backup carries the AI Agent approval and phone push choices and lyrics offsets", () => {
  for (const key of [
    "fuyu-agent-approval",
    "fuyu-agent-push",
    "fuyu-lyrics-offsets",
    "fuyu-collapsed-items",
    "fuyu-plugin-market-favorites",
    "fuyu-screenshot-annotation",
  ]) {
    assert.ok(BACKUP_KEYS.includes(key), key);
  }
  // What sessions were looked at or removed is per-computer state, not a preference.
  for (const key of ["fuyu-agent-seen-turns", "fuyu-agent-hidden-sessions"]) {
    assert.ok(!BACKUP_KEYS.includes(key), key);
  }
});

test("backup files are named by local date and time", () => {
  assert.equal(backupFileName(new Date(2026, 10, 6, 9, 5)), "fuyu-settings-2026-11-06-0905.json");
});

test("restoring takes known text keys and refuses other files", () => {
  const file = JSON.stringify({
    app: "fuyu",
    version: 1,
    keys: { "fuyu-locale": "en", "fuyu-todos": "[x]", "fuyu-settings": { opacity: 1 } },
  });
  assert.deepEqual(parseBackup(`﻿${file}`), { keys: { "fuyu-locale": "en" } });
  assert.deepEqual(parseBackup("not json"), { problem: "notJson" });
  assert.deepEqual(parseBackup('{"app":"other","keys":{}}'), { problem: "notBackup" });
  assert.deepEqual(parseBackup('{"app":"fly-island","version":2,"keys":{}}'), { problem: "newerVersion" });
  assert.deepEqual(parseBackup('{"app":"fly-island","version":1,"keys":{"fuyu-todos":"[x]"}}'), { problem: "empty" });
});

test("a backup from before the rename restores under the new key names", () => {
  const old = JSON.stringify({
    app: "fly-island",
    version: 1,
    keys: { "focusd-island-settings": '{"opacity":80}', "focusd-island-locale": "en", "focusd-island-todos": "[x]" },
  });
  assert.deepEqual(parseBackup(old), { keys: { "fuyu-settings": '{"opacity":80}', "fuyu-locale": "en" } });
  // A file with both names (edited by hand) keeps the new one.
  const both = JSON.stringify({ app: "fuyu", version: 1, keys: { "fuyu-locale": "zh-CN", "focusd-island-locale": "en" } });
  assert.deepEqual(parseBackup(both), { keys: { "fuyu-locale": "zh-CN" } });
});
