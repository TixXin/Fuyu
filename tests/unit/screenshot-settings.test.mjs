import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SCREENSHOT_SETTINGS,
  normalizeScreenshotSettings,
  saveFolderOf,
  shortcutConfig,
} from "../../src/features/screenshot/settings.ts";

test("missing or broken screenshot settings fall back to Ctrl+Shift+digits, no PrintScreen and an 8 s card", () => {
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
  });
  assert.equal(settings.shortcuts.region, "Alt+Q");
  assert.equal(settings.shortcuts.copy, "");
  assert.equal(settings.shortcuts.text, "Ctrl+Shift+3");
  assert.equal(settings.shortcuts.pins, "");
  assert.equal(settings.printScreen, true);
  assert.equal(settings.saveFolder, "D:\\Shots");
  assert.equal(settings.cardSeconds, 8);
  assert.equal(normalizeScreenshotSettings({ cardSeconds: 0 }).cardSeconds, 0);
});

test("the native side gets every action in order, and an empty folder means the default", () => {
  assert.deepEqual(shortcutConfig(DEFAULT_SCREENSHOT_SETTINGS).map(({ action }) => action), ["region", "copy", "text", "translate", "fullscreen", "pins"]);
  assert.equal(saveFolderOf(DEFAULT_SCREENSHOT_SETTINGS), undefined);
  assert.equal(saveFolderOf({ ...DEFAULT_SCREENSHOT_SETTINGS, saveFolder: "D:\\Shots" }), "D:\\Shots");
});
