import assert from "node:assert/strict";
import test from "node:test";
import { resolveThemeColors, surfaceThemeColors, surfaceTone, THEME_COLORS, themeColors, withThemeColors } from "../../src/features/appearance/themeMode.ts";
import { DEFAULT_SETTINGS, normalizeSettings } from "../../src/features/appearance/settings.ts";
import { parseTheme } from "../../src/features/appearance/theme.ts";
import { isLightIsland } from "../../src/utils/color.ts";

test("the island uses the dark or light set, or the system's (C31, C33.3)", () => {
  const tuned = withThemeColors(DEFAULT_SETTINGS, "dark", { islandBackgroundColor: "#102030", taskTextColor: "#ffffff", pulseColor: "#00ff88" });
  assert.equal(resolveThemeColors({ ...tuned, themeMode: "dark" }, false).islandBackgroundColor, "#102030");
  assert.equal(resolveThemeColors({ ...tuned, themeMode: "light" }, true).islandBackgroundColor, THEME_COLORS.light.islandBackgroundColor);
  assert.equal(resolveThemeColors({ ...tuned, themeMode: "system" }, true).islandBackgroundColor, "#102030");
  assert.equal(resolveThemeColors({ ...tuned, themeMode: "system" }, false).taskTextColor, THEME_COLORS.light.taskTextColor);
  assert.deepEqual(themeColors(tuned, "light"), THEME_COLORS.light);
  assert.ok(isLightIsland(THEME_COLORS.light.islandBackgroundColor));
  assert.ok(!isLightIsland(THEME_COLORS.dark.islandBackgroundColor));
});

test("settings from before the two sets keep their colours, in the set they look like", () => {
  assert.equal(DEFAULT_SETTINGS.themeMode, "dark");
  const darkPick = normalizeSettings({ opacity: 95, islandBackgroundColor: "#336699", taskTextColor: "#ffcc00", pulseColor: "#ff00ff" });
  assert.equal(darkPick.themeMode, "dark");
  assert.deepEqual(themeColors(darkPick, "dark"), { islandBackgroundColor: "#336699", taskTextColor: "#ffcc00", pulseColor: "#ff00ff" });
  assert.deepEqual(themeColors(darkPick, "light"), THEME_COLORS.light);
  assert.equal(resolveThemeColors(darkPick, true).islandBackgroundColor, "#336699", "nothing looks different after the upgrade");
  const lightPick = normalizeSettings({ islandBackgroundColor: "#fafafa", taskTextColor: "#111111", pulseColor: "#3ae489" });
  assert.equal(lightPick.themeMode, "light");
  assert.equal(lightPick.lightBackgroundColor, "#fafafa");
  assert.equal(normalizeSettings({ themeMode: "system", islandBackgroundColor: "#336699" }).darkBackgroundColor, THEME_COLORS.dark.islandBackgroundColor);
  assert.equal(normalizeSettings({ themeMode: "sepia" }).themeMode, "dark");
});

test("a theme file from before the two sets puts its colours into the set they look like", () => {
  const file = JSON.stringify({ app: "fly-island", kind: "theme", version: 1, name: "Paper", appearance: { islandBackgroundColor: "#f7f3e8", taskTextColor: "#222222", pulseColor: "#d4502a" } });
  const current = { ...DEFAULT_SETTINGS, themeMode: "system" };
  const parsed = parseTheme(file, current);
  assert.ok("settings" in parsed);
  assert.equal(parsed.settings.themeMode, "light");
  assert.equal(parsed.settings.lightBackgroundColor, "#f7f3e8");
  assert.equal(parsed.settings.darkBackgroundColor, THEME_COLORS.dark.islandBackgroundColor);
});

test("a light island can stay dark while collapsed, in the dark set's colours (C33.2)", () => {
  const tuned = withThemeColors({ ...DEFAULT_SETTINGS, collapsedDark: true }, "dark", { ...THEME_COLORS.dark, islandBackgroundColor: "#101820" });
  const light = resolveThemeColors({ ...tuned, themeMode: "light" }, false);
  assert.equal(surfaceThemeColors(light, "collapsed").islandBackgroundColor, "#101820");
  assert.equal(surfaceThemeColors({ ...light, collapsedDark: false }, "collapsed").islandBackgroundColor, THEME_COLORS.light.islandBackgroundColor);
  const dark = resolveThemeColors({ ...tuned, themeMode: "dark" }, false);
  assert.equal(surfaceThemeColors(dark, "collapsed"), dark);
  assert.equal(DEFAULT_SETTINGS.collapsedDark, false);
  assert.equal(normalizeSettings({ opacity: 95 }).collapsedDark, false, "older settings keep a picked light colour when collapsed");
});

test("the panel and the other windows can each stay dark too, on their own", () => {
  const tuned = withThemeColors(DEFAULT_SETTINGS, "dark", { ...THEME_COLORS.dark, islandBackgroundColor: "#101820" });
  const light = resolveThemeColors({ ...tuned, themeMode: "light", panelDark: true }, false);
  assert.equal(surfaceThemeColors(light, "panel").islandBackgroundColor, "#101820");
  assert.equal(surfaceThemeColors(light, "collapsed"), light, "the collapsed island keeps the light set");
  assert.equal(surfaceTone(light, false, "windows"), "light");
  assert.equal(surfaceTone({ ...light, windowsDark: true }, false, "windows"), "dark");
  assert.equal(surfaceTone({ ...light, themeMode: "system" }, true, "windows"), "dark");
  assert.equal(DEFAULT_SETTINGS.panelDark, false);
  assert.equal(DEFAULT_SETTINGS.windowsDark, false);
  const older = normalizeSettings({ collapsedDark: true, panelDark: "yes" });
  assert.deepEqual([older.collapsedDark, older.panelDark, older.windowsDark], [true, false, false], "settings saved before this keep only the collapsed island dark");
});

test("the accent ships as it was, and can follow Windows or be picked (C33.5)", async () => {
  const { accentVariables } = await import("../../src/features/appearance/themeMode.ts");
  assert.equal(DEFAULT_SETTINGS.accentMode, "default");
  assert.equal(normalizeSettings({}).accentMode, "default");
  assert.equal(normalizeSettings({ accentMode: "windows" }).accentMode, "windows");
  assert.equal(normalizeSettings({ accentMode: "neon", accentColor: "red" }).accentColor, DEFAULT_SETTINGS.accentColor);
  assert.deepEqual(accentVariables(null), {});
  const style = accentVariables("#0078d4");
  assert.equal(style["--color-accent"], "#0078d4");
  assert.equal(style["--color-focus-ring"], "rgba(0, 120, 212, 0.88)");
});
