import assert from "node:assert/strict";
import test from "node:test";
import { keepPickedColors, resolveThemeColors, THEME_COLORS } from "../../src/features/appearance/themeMode.ts";
import { DEFAULT_SETTINGS, normalizeSettings } from "../../src/features/appearance/settings.ts";
import { isLightIsland } from "../../src/utils/color.ts";

const picked = { ...DEFAULT_SETTINGS, islandBackgroundColor: "#336699", taskTextColor: "#ffcc00", pulseColor: "#ff00ff" };

test("dark, light and system use the built-in colours; custom keeps the picked ones (C31)", () => {
  assert.equal(resolveThemeColors({ ...picked, themeMode: "dark" }, false).islandBackgroundColor, THEME_COLORS.dark.islandBackgroundColor);
  assert.equal(resolveThemeColors({ ...picked, themeMode: "light" }, true).islandBackgroundColor, THEME_COLORS.light.islandBackgroundColor);
  assert.equal(resolveThemeColors({ ...picked, themeMode: "system" }, true).taskTextColor, THEME_COLORS.dark.taskTextColor);
  assert.equal(resolveThemeColors({ ...picked, themeMode: "system" }, false).taskTextColor, THEME_COLORS.light.taskTextColor);
  assert.equal(resolveThemeColors({ ...picked, themeMode: "custom" }, false).islandBackgroundColor, "#336699");
  assert.ok(isLightIsland(THEME_COLORS.light.islandBackgroundColor));
  assert.ok(!isLightIsland(THEME_COLORS.dark.islandBackgroundColor));
});

test("saving while a built-in theme is on keeps the colours picked by hand", () => {
  const stored = { ...picked, themeMode: "light" };
  const shown = resolveThemeColors(stored, false);
  const saved = keepPickedColors({ ...shown, opacity: 80 }, stored);
  assert.equal(saved.opacity, 80);
  assert.equal(saved.islandBackgroundColor, "#336699");
  const custom = keepPickedColors({ ...shown, themeMode: "custom", islandBackgroundColor: "#ffffff" }, stored);
  assert.equal(custom.islandBackgroundColor, "#ffffff");
});

test("new installs start dark; older settings keep their own colours", () => {
  assert.equal(DEFAULT_SETTINGS.themeMode, "dark");
  assert.equal(normalizeSettings({ opacity: 95 }).themeMode, "custom");
  assert.equal(normalizeSettings({ themeMode: "light" }).themeMode, "light");
  assert.equal(normalizeSettings({ themeMode: "sepia" }).themeMode, "custom");
});
