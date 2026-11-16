import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DEFAULT_AGENT_APPROVAL_SETTINGS } from "../../src/features/agent-status/approvals/storage.ts";
import { DEFAULT_AGENT_PUSH_SETTINGS } from "../../src/features/agent-status/push/storage.ts";
import { DEFAULT_AGENT_SOUND_SETTINGS } from "../../src/features/agent-status/sounds/storage.ts";
import { DEFAULT_SETTINGS } from "../../src/features/appearance/settingsDefaults.ts";
import { normalizeScreenshotSettings } from "../../src/features/screenshot/settings.ts";
import { BACKUP_KEYS } from "../../src/features/settings-backup/backup.ts";
import { DEFAULT_SETTINGS as DEFAULT_TRANSLATION_SETTINGS } from "../../src/features/translation/storage.ts";

const whitelist = JSON.parse(readFileSync(new URL("../../src-tauri/src/sync/settings_whitelist.json", import.meta.url), "utf8"));
const MODES = new Set(["sync", "local", "firstMergeOnly", "byId"]);

const OBJECT_SETTINGS = {
  "fuyu-settings": DEFAULT_SETTINGS,
  "fuyu-translation-settings": DEFAULT_TRANSLATION_SETTINGS,
  "fuyu-screenshot-settings": normalizeScreenshotSettings(undefined),
  "fuyu-agent-sounds": DEFAULT_AGENT_SOUND_SETTINGS,
  "fuyu-agent-approval": DEFAULT_AGENT_APPROVAL_SETTINGS,
  "fuyu-agent-push": DEFAULT_AGENT_PUSH_SETTINGS,
};

const sorted = (values) => [...values].sort();

test("every backed-up setting key is in the sync whitelist and nothing else is", () => {
  assert.deepEqual(sorted(Object.keys(whitelist.keys)), sorted(BACKUP_KEYS), "add the new key to src-tauri/src/sync/settings_whitelist.json and decide sync / local / firstMergeOnly");
});

test("every field of the object settings is in the sync whitelist", () => {
  for (const [key, defaults] of Object.entries(OBJECT_SETTINGS)) {
    const rule = whitelist.keys[key];
    assert.equal(typeof rule, "object", `${key} needs a fields list`);
    assert.deepEqual(sorted(Object.keys(rule.fields)), sorted(Object.keys(defaults)), `${key}: list each field in settings_whitelist.json`);
  }
  const withFields = Object.entries(whitelist.keys).filter(([, rule]) => typeof rule === "object").map(([key]) => key);
  assert.deepEqual(sorted(withFields), sorted(Object.keys(OBJECT_SETTINGS)));
});

test("every rule is a known mode", () => {
  for (const [key, rule] of Object.entries(whitelist.keys)) {
    const modes = typeof rule === "string" ? [rule] : Object.values(rule.fields);
    for (const mode of modes) assert.ok(MODES.has(mode), `${key}: unknown mode ${mode}`);
  }
});

test("the user's choices hold: screen sizes and shortcuts stay local, module switches only go over on the first merge", () => {
  const fields = whitelist.keys["fuyu-settings"].fields;
  for (const field of ["collapsedWidthExtra", "collapsedScale", "expandedScale", "panelWidth", "maxPanelHeight", "pageNextShortcut", "pagePreviousShortcut", "pageDigitModifiers"]) {
    assert.equal(fields[field], "local", field);
  }
  for (const field of ["todoEnabled", "musicEnabled", "mailEnabled", "calendarEnabled", "shelfEnabled", "translationEnabled", "screenshotEnabled", "agentStatusEnabled"]) {
    assert.equal(fields[field], "firstMergeOnly", field);
  }
  assert.equal(fields.todoProjects, "byId");
  assert.equal(whitelist.keys["fuyu-setting-presets"], "byId");
  assert.equal(whitelist.keys["fuyu-translation-settings"].fields.shortcut, "local");
  assert.equal(whitelist.keys["fuyu-screenshot-settings"].fields.shortcuts, "local");
  for (const key of ["fuyu-qq-notifications-enabled", "fuyu-wechat-reminders-enabled", "fuyu-wechat-expose-ui", "fuyu-wechat-hide-taskbar-button"]) {
    assert.equal(whitelist.keys[key], "local", key);
  }
});
