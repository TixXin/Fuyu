import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_VOICE_INPUT_SETTINGS,
  DEFAULT_VOICE_SHORTCUT,
  appendToNote,
  downloadPercent,
  formatMegabytes,
  normalizeVoiceInputSettings,
  reconcileVoiceSwitch,
  voiceClock,
  withVoicePluginSwitch,
} from "../../src/features/voice-input/settings.ts";

test("voice input is off until turned on and keeps a default shortcut", () => {
  assert.deepEqual(normalizeVoiceInputSettings(undefined), DEFAULT_VOICE_INPUT_SETTINGS);
  assert.deepEqual(normalizeVoiceInputSettings("broken"), DEFAULT_VOICE_INPUT_SETTINGS);
  assert.deepEqual(normalizeVoiceInputSettings({ enabled: true, shortcut: " Alt+V " }), { enabled: true, shortcut: "Alt+V" });
  assert.deepEqual(normalizeVoiceInputSettings({ enabled: "yes", shortcut: 3 }), { enabled: false, shortcut: DEFAULT_VOICE_SHORTCUT });
  assert.equal(normalizeVoiceInputSettings({ shortcut: "" }).shortcut, "");
  assert.equal(normalizeVoiceInputSettings({ shortcut: "x".repeat(65) }).shortcut, DEFAULT_VOICE_SHORTCUT);
});

test("the recording clock counts minutes and seconds", () => {
  assert.equal(voiceClock(0), "0:00");
  assert.equal(voiceClock(9_999), "0:09");
  assert.equal(voiceClock(125_000), "2:05");
  assert.equal(voiceClock(-50), "0:00");
});

test("download progress stays between 0 and 100", () => {
  assert.equal(downloadPercent(50, 200), 25);
  assert.equal(downloadPercent(300, 200), 100);
  assert.equal(downloadPercent(5, 0), 0);
  assert.equal(formatMegabytes(165_783_878), "166 MB");
  assert.equal(formatMegabytes(0), "1 MB");
});

test("dictated text goes on a new line of the daily note", () => {
  assert.equal(appendToNote("", "  买牛奶 "), "买牛奶");
  assert.equal(appendToNote("早上开会", "买牛奶"), "早上开会\n买牛奶");
  assert.equal(appendToNote("早上开会\n", "买牛奶"), "早上开会\n买牛奶");
  assert.equal(appendToNote("早上开会", "   "), "早上开会");
});

test("the voice input switch migrates to plugins.yml once and stays mirrored without looping", () => {
  assert.deepEqual(withVoicePluginSwitch({ enabled: false, shortcut: "Alt+V" }, undefined), { enabled: false, shortcut: "Alt+V" });
  assert.deepEqual(withVoicePluginSwitch({ enabled: false, shortcut: "Alt+V" }, true), { enabled: true, shortcut: "Alt+V" });
  assert.equal(reconcileVoiceSwitch(false, undefined, null, false), null);

  const firstOff = reconcileVoiceSwitch(false, true, null, false);
  assert.deepEqual(firstOff, { switchTo: false, migrated: true, seen: { stored: false, switched: true } });

  const firstOn = reconcileVoiceSwitch(true, true, null, false);
  assert.deepEqual(firstOn, { migrated: true, seen: { stored: true, switched: true } });

  const firstFileOff = reconcileVoiceSwitch(true, false, null, false);
  assert.deepEqual(firstFileOff, { mirror: false, migrated: true, seen: { stored: true, switched: false } });

  const steady = reconcileVoiceSwitch(false, false, { stored: false, switched: false }, true);
  assert.deepEqual(steady, { migrated: false, seen: { stored: false, switched: false } });

  const flippedInPluginsPage = reconcileVoiceSwitch(false, true, steady.seen, true);
  assert.deepEqual(flippedInPluginsPage, { mirror: true, migrated: false, seen: { stored: false, switched: true } });

  const afterMirror = reconcileVoiceSwitch(true, true, { stored: true, switched: true }, true);
  assert.deepEqual(afterMirror, { migrated: false, seen: { stored: true, switched: true } });

  const restoredFromBackup = reconcileVoiceSwitch(false, true, afterMirror.seen, true);
  assert.deepEqual(restoredFromBackup, { switchTo: false, migrated: false, seen: { stored: false, switched: true } });
});
