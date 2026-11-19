import assert from "node:assert/strict";
import test from "node:test";
import { BUILTIN_THEME_IDS, BUILTIN_THEMES, builtinThemeInUse, withBuiltinTheme } from "../../src/lib/theme/builtinThemes.ts";
import { DEFAULT_SETTINGS, normalizeSettings, THEME_SETTING_KEYS } from "../../src/lib/settings/settings.ts";
import { buildTheme, parseTheme } from "../../src/lib/theme/theme.ts";
import { autoInkHex, inkVariables, resolveThemeColors, surfaceThemeColors } from "../../src/lib/theme/themeMode.ts";

test("auto ink keeps the old black-or-white text (C33.9)", () => {
  assert.deepEqual(inkVariables({ islandBackgroundColor: "#030303", inkColor: "" }), { "--island-ink-rgb": "241, 240, 246" });
  assert.deepEqual(inkVariables({ islandBackgroundColor: "#f2f2f5", inkColor: "" }), { "--island-ink-rgb": "24, 24, 30" });
  assert.equal(autoInkHex("#f2f2f5"), "#18181e");
  assert.equal(autoInkHex("#000000"), "#f1f0f6");
});

test("a custom ink moves the ink and the text levels, not the accent", () => {
  const vars = inkVariables({ islandBackgroundColor: "#030303", inkColor: "#ffd9a0" });
  assert.equal(vars["--island-ink-rgb"], "255, 217, 160");
  assert.equal(vars["--text-1"], "rgba(255, 217, 160, 0.96)");
  assert.equal(vars["--text-3"], "rgba(255, 217, 160, 0.54)");
  assert.equal(inkVariables({ islandBackgroundColor: "#f2f2f5", inkColor: "#2a2118" })["--text-2"], "rgba(42, 33, 24, 0.7)");
  assert.ok(!("--color-accent" in vars));
});

test("ink is kept per set, defaults to auto and travels with themes", () => {
  const old = normalizeSettings({ darkBackgroundColor: "#030303", lightBackgroundColor: "#f2f2f5", themeMode: "dark" });
  assert.equal(old.darkInkColor, "");
  assert.equal(old.lightInkColor, "");
  assert.equal(normalizeSettings({ darkInkColor: "red" }).darkInkColor, "");
  const tuned = normalizeSettings({ ...DEFAULT_SETTINGS, themeMode: "light", lightInkColor: "#2a2118" });
  assert.equal(resolveThemeColors(tuned, false).inkColor, "#2a2118");
  assert.equal(resolveThemeColors({ ...tuned, themeMode: "dark" }, false).inkColor, "");
  assert.equal(surfaceThemeColors({ ...resolveThemeColors(tuned, false), collapsedDark: true }, "collapsed").inkColor, "");
  assert.ok(THEME_SETTING_KEYS.includes("lightInkColor"));
  const file = buildTheme("暖", tuned, new Date(0));
  assert.equal(file.appearance.lightInkColor, "#2a2118");
  const back = parseTheme(JSON.stringify(file), DEFAULT_SETTINGS);
  assert.equal(back.settings.lightInkColor, "#2a2118");
  const { lightInkColor, darkInkColor, inkColor, ...older } = file.appearance;
  const oldFile = parseTheme(JSON.stringify({ ...file, appearance: older }), tuned);
  assert.equal(oldFile.settings.lightInkColor, "", "a theme file from before C33.9 brings back auto ink");
  assert.ok(lightInkColor && darkInkColor === "" && inkColor === "#2a2118");
});

test("built-in sets apply both tones, keep following the system, and are recognised", () => {
  for (const id of BUILTIN_THEME_IDS) {
    const applied = withBuiltinTheme({ ...DEFAULT_SETTINGS, appearanceMode: "liquidGlass" }, id);
    assert.equal(applied.appearanceMode, "classic");
    assert.equal(applied.opacity, BUILTIN_THEMES[id].opacity);
    assert.equal(applied.themeMode, BUILTIN_THEMES[id].tone);
    assert.equal(applied.lightBackgroundColor, BUILTIN_THEMES[id].light.islandBackgroundColor);
    assert.equal(applied.darkBackgroundColor, BUILTIN_THEMES[id].dark.islandBackgroundColor);
    assert.equal(builtinThemeInUse(normalizeSettings(applied)), id);
  }
  assert.equal(withBuiltinTheme({ ...DEFAULT_SETTINGS, themeMode: "system" }, "greyWhite").themeMode, "system");
  assert.equal(builtinThemeInUse(DEFAULT_SETTINGS), "default", "a fresh install reads as the default set, not custom");
  const back = withBuiltinTheme(withBuiltinTheme(DEFAULT_SETTINGS, "frostedWarm"), "default");
  assert.equal(back.themeMode, "dark", "going back to the default set from a light set turns the colors dark again");
  assert.equal(builtinThemeInUse(normalizeSettings(back)), "default");
  assert.equal(builtinThemeInUse({ ...withBuiltinTheme(DEFAULT_SETTINGS, "frostedClear"), opacity: 70 }), null);
});
