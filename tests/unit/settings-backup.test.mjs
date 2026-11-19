import assert from "node:assert/strict";
import test from "node:test";
import { BACKUP_KEYS, backupFileName, buildBackup, parseBackup, switchesFromBackup, withSwitchSnapshot } from "../../src/lib/settings-backup/backup.ts";
import { collectBackup, registerBackupSwitches, restoreBackup } from "../../src/lib/settings-backup/storage.ts";
import {
  SETTINGS_FILE_WRITE_DEBOUNCE_MS,
  createSettingsFileSyncController,
  shouldSyncStorageKey,
} from "../../src/lib/settings-backup/useSettingsFileSync.ts";

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
    "fuyu-screenshot-annotation",
    "fuyu-voice-input",
  ]) {
    assert.ok(BACKUP_KEYS.includes(key), key);
  }
  for (const key of ["fuyu-agent-seen-turns", "fuyu-agent-hidden-sessions", "fuyu-plugin-pages", "fuyu-plugin-market-favorites"]) {
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

test("an old backup with the removed plugin keys restores the rest and drops them", () => {
  const old = JSON.stringify({
    app: "fuyu",
    version: 1,
    keys: {
      "fuyu-locale": "en",
      "fuyu-plugin-pages": '{"order":["plugin:x/main"],"hidden":[]}',
      "fuyu-plugin-market-favorites": '["@acme/x"]',
    },
  });
  assert.deepEqual(parseBackup(old), { keys: { "fuyu-locale": "en" } });
});

test("a backup from before the rename restores under the new key names", () => {
  const old = JSON.stringify({
    app: "fly-island",
    version: 1,
    keys: { "focusd-island-settings": '{"opacity":80}', "focusd-island-locale": "en", "focusd-island-todos": "[x]" },
  });
  assert.deepEqual(parseBackup(old), { keys: { "fuyu-settings": '{"opacity":80}', "fuyu-locale": "en" } });
  const both = JSON.stringify({ app: "fuyu", version: 1, keys: { "fuyu-locale": "zh-CN", "focusd-island-locale": "en" } });
  assert.deepEqual(parseBackup(both), { keys: { "fuyu-locale": "zh-CN" } });
});

test("exporting with a built-in switch snapshot records plugin and message source switches and restoring applies them", () => {
  const snapshot = {
    enabled: { todos: false, screenshot: true, agents: false, "voice-input": true },
    config: { messages: { qq: false, wechat: true, mail: false } },
  };
  const exported = withSwitchSnapshot({ "fuyu-settings": '{"opacity":90}' }, snapshot);
  const savedSettings = JSON.parse(exported["fuyu-settings"]);
  assert.equal(savedSettings.opacity, 90);
  assert.equal(savedSettings.todoEnabled, false);
  assert.equal(savedSettings.screenshotEnabled, true);
  assert.equal(savedSettings.agentStatusEnabled, false);
  assert.equal(savedSettings.mailEnabled, false);
  assert.equal(exported["fuyu-qq-notifications-enabled"], "false");
  assert.equal(exported["fuyu-wechat-reminders-enabled"], "true");
  assert.deepEqual(JSON.parse(exported["fuyu-voice-input"]), { enabled: true, shortcut: "Ctrl+Shift+Space" });

  const restored = switchesFromBackup(exported);
  assert.deepEqual(restored.plugins, [
    ["todos", false],
    ["screenshot", true],
    ["agents", false],
    ["voice-input", true],
  ]);
  assert.deepEqual(restored.configs, [
    ["messages", "mail", false],
    ["messages", "qq", false],
    ["messages", "wechat", true],
  ]);
  assert.ok(restored.migrated.includes("todoEnabled") && restored.migrated.includes("fuyu-voice-input"));
});

test("collectBackup and restoreBackup bridge built-in switches even when fuyu-settings was absent before export", () => {
  const store = new Map();
  const prevWindow = globalThis.window;
  const localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
  };
  globalThis.window = { localStorage, dispatchEvent: () => true };
  const applied = [];
  registerBackupSwitches({
    snapshot: () => ({
      enabled: { todos: false, music: true, screenshot: false },
      config: { messages: { qq: false, wechat: false, mail: true } },
    }),
    apply: (restored) => { applied.push(restored); },
  });
  try {
    const backup = collectBackup(new Date("2026-11-17T08:00:00Z"));
    assert.equal(JSON.parse(backup.keys["fuyu-settings"]).todoEnabled, false);
    assert.equal(backup.keys["fuyu-qq-notifications-enabled"], "false");
    store.clear();
    const count = restoreBackup(backup.keys);
    assert.ok(count > 0);
    assert.equal(applied.length, 1);
    assert.deepEqual(applied[0].plugins, [["todos", false], ["screenshot", false], ["music", true]]);
    assert.deepEqual(applied[0].configs, [["messages", "mail", true], ["messages", "qq", false], ["messages", "wechat", false]]);
  } finally {
    registerBackupSwitches(null);
    if (prevWindow === undefined) delete globalThis.window;
    else globalThis.window = prevWindow;
  }
});

test("settings file sync ignores non-backup storage keys, coalesces rapid slider updates into one debounced write, and flushes on hide or unmount", async () => {
  assert.equal(shouldSyncStorageKey(null), true);
  assert.equal(shouldSyncStorageKey("fuyu-settings"), true);
  assert.equal(shouldSyncStorageKey("fuyu-locale"), true);
  assert.equal(shouldSyncStorageKey("fuyu-panel-preview"), false);
  assert.equal(shouldSyncStorageKey("fuyu-settings-focus"), false);
  assert.equal(shouldSyncStorageKey("fuyu-settings-file-synced"), false);

  const store = new Map([["fuyu-settings", '{"opacity":60}']]);
  let synced = null;
  const written = [];
  const timers = new Map();
  let nextTimerId = 1;

  const controller = createSettingsFileSyncController({
    readKey: (key) => store.get(key) ?? null,
    readSwitches: () => null,
    readSynced: () => synced,
    saveSynced: (print) => {
      synced = print;
    },
    writeFile: async (text) => {
      written.push(JSON.parse(text));
    },
    now: () => new Date("2026-11-18T06:00:00Z"),
    setTimer: (callback, ms) => {
      const id = nextTimerId++;
      timers.set(id, { callback, ms });
      return id;
    },
    clearTimer: (id) => {
      timers.delete(id);
    },
  });

  const settle = () => new Promise((resolve) => setImmediate(resolve));

  controller.check();
  await settle();
  assert.equal(written.length, 1);
  assert.equal(written[0].keys["fuyu-settings"], '{"opacity":60}');

  controller.onStorage({ key: "fuyu-panel-preview" });
  controller.onStorage({ key: "fuyu-settings-focus" });
  assert.equal(timers.size, 0);
  assert.equal(written.length, 1);

  for (let step = 61; step <= 85; step += 1) {
    store.set("fuyu-settings", JSON.stringify({ opacity: step }));
    controller.onStorage({ key: "fuyu-settings" });
  }
  assert.equal(timers.size, 1);
  const [[, scheduled]] = timers.entries();
  assert.equal(scheduled.ms, SETTINGS_FILE_WRITE_DEBOUNCE_MS);

  controller.poll();
  assert.equal(written.length, 1);

  timers.clear();
  scheduled.callback();
  await settle();
  assert.equal(written.length, 2);
  assert.equal(written[1].keys["fuyu-settings"], '{"opacity":85}');

  store.set("fuyu-settings", '{"opacity":92}');
  controller.schedule();
  assert.equal(timers.size, 1);
  assert.equal(written.length, 2);

  controller.flush();
  await settle();
  assert.equal(timers.size, 0);
  assert.equal(written.length, 3);
  assert.equal(written[2].keys["fuyu-settings"], '{"opacity":92}');
});
