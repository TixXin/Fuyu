import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SCREENSHOT_SETTINGS,
  normalizeScreenshotSettings,
  saveFolderOf,
  shortcutConfig,
} from "../../src/features/screenshot/settings.ts";

test("missing or broken screenshot settings fall back to Ctrl+Shift+digits, no PrintScreen and a 3 s card", () => {
  assert.deepEqual(normalizeScreenshotSettings(null), DEFAULT_SCREENSHOT_SETTINGS);
  assert.deepEqual(normalizeScreenshotSettings("x"), DEFAULT_SCREENSHOT_SETTINGS);
  assert.equal(DEFAULT_SCREENSHOT_SETTINGS.shortcuts.pins, "", "the global pins shortcut starts unset");
  assert.equal(DEFAULT_SCREENSHOT_SETTINGS.printScreen, false);
});

test("a cleared shortcut stays off, odd values are replaced, and the folder is trimmed", () => {
  const settings = normalizeScreenshotSettings({
    shortcuts: { region: "Alt+Q", copy: "", text: 3, pins: "x".repeat(80) },
    printScreen: true,
    saveFolder: "  D:\\Shots  ",
    cardSeconds: 9,
    version: 2,
  });
  assert.equal(settings.shortcuts.region, "Alt+Q");
  assert.equal(settings.shortcuts.copy, "");
  assert.equal(settings.shortcuts.text, "Ctrl+Shift+3");
  assert.equal(settings.shortcuts.pins, "");
  assert.equal(settings.printScreen, true);
  assert.equal(settings.saveFolder, "D:\\Shots");
  assert.equal(settings.cardSeconds, 3);
  assert.equal(settings.historyDays, 7);
  assert.equal(normalizeScreenshotSettings({ historyDays: 30 }).historyDays, 30);
  assert.equal(normalizeScreenshotSettings({ cardSeconds: 0, version: 2 }).cardSeconds, 0);
  assert.equal(normalizeScreenshotSettings({ cardSeconds: 8 }).cardSeconds, 3, "the 8 s default saved before version 2 moves to 3 s");
});

test("the native side gets every action in order, and an empty folder means the default", () => {
  assert.deepEqual(shortcutConfig(DEFAULT_SCREENSHOT_SETTINGS).map(({ action }) => action), ["region", "copy", "text", "translate", "long", "fullscreen", "pins"]);
  assert.equal(saveFolderOf(DEFAULT_SCREENSHOT_SETTINGS), undefined);
  assert.equal(saveFolderOf({ ...DEFAULT_SCREENSHOT_SETTINGS, saveFolder: "D:\\Shots" }), "D:\\Shots");
});
