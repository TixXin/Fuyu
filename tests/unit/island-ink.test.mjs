import assert from "node:assert/strict";
import test from "node:test";
import { BUILTIN_THEME_IDS, BUILTIN_THEMES, builtinThemeInUse, withBuiltinTheme } from "../../src/lib/theme/builtinThemes.ts";
import { GLASS_SETTING_KEYS } from "../../src/lib/settings/glassSettings.ts";
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

test("built-in themes carry full style sets, keep following the system, and detect tweaks", () => {
  assert.equal(BUILTIN_THEME_IDS.length, 12);
  for (const id of BUILTIN_THEME_IDS) {
    const theme = BUILTIN_THEMES[id];
    const start = { ...DEFAULT_SETTINGS, appearanceMode: theme.appearanceMode === "classic" ? "liquidGlass" : "classic" };
    const applied = withBuiltinTheme({ ...start }, id);
    const saved = normalizeSettings(applied);
    assert.equal(saved.appearanceMode, theme.appearanceMode);
    assert.equal(saved.opacity, theme.opacity);
    assert.equal(saved.islandOpacity, theme.islandOpacity);
    assert.equal(saved.fontFamily, theme.fontFamily);
    assert.equal(saved.fontScale, theme.fontScale);
    assert.equal(saved.islandCornerShape, theme.islandCornerShape);
    assert.equal(saved.islandCornerRadius, theme.islandCornerRadius);
    assert.equal(saved.topFilletRadius, theme.topFilletRadius);
    assert.equal(saved.accentMode, theme.accentMode);
    assert.equal(saved.accentColor, theme.accentColor);
    assert.equal(saved.pulseBrightness, theme.pulseBrightness);
    assert.equal(saved.themeMode, theme.tone);
    assert.equal(saved.lightBackgroundColor, theme.light.islandBackgroundColor);
    assert.equal(saved.darkBackgroundColor, theme.dark.islandBackgroundColor);
    if (theme.appearanceMode === "liquidGlass") {
      assert.ok(theme.glass, `${id} defines glass settings`);
      assert.equal(saved.glassIntensity, theme.glass.glassIntensity);
      for (const key of GLASS_SETTING_KEYS) {
        assert.equal(saved[key], theme.glass[key], `${id} keeps ${key}`);
      }
    }
    assert.equal(builtinThemeInUse(saved), id);
  }
  assert.equal(withBuiltinTheme({ ...DEFAULT_SETTINGS, themeMode: "system" }, "swissChalk").themeMode, "system");
  assert.equal(builtinThemeInUse(DEFAULT_SETTINGS), "default", "a fresh install reads as the default set, not custom");
  const back = withBuiltinTheme(withBuiltinTheme(DEFAULT_SETTINGS, "liquidAurora"), "default");
  assert.equal(back.themeMode, "dark", "going back to the default set from another theme turns the colors dark again");
  assert.equal(back.appearanceMode, "classic");
  assert.equal(back.fontFamily, "system");
  assert.equal(back.islandCornerRadius, DEFAULT_SETTINGS.islandCornerRadius);
  assert.equal(builtinThemeInUse(normalizeSettings(back)), "default");
  assert.equal(builtinThemeInUse({ ...withBuiltinTheme(DEFAULT_SETTINGS, "arcticFrost"), opacity: 70 }), null);
  assert.equal(builtinThemeInUse({ ...withBuiltinTheme(DEFAULT_SETTINGS, "arcticFrost"), glassBlur: 30 }), null);
  assert.equal(builtinThemeInUse({ ...withBuiltinTheme(DEFAULT_SETTINGS, "warmPaper"), fontFamily: "system" }), null);
  assert.equal(builtinThemeInUse({ ...withBuiltinTheme(DEFAULT_SETTINGS, "monoTerminal"), topFilletRadius: 8 }), null);
  assert.equal(builtinThemeInUse({ ...withBuiltinTheme(DEFAULT_SETTINGS, "swissChalk"), accentColor: "#112233" }), null);
});

test("legacy saved settings from pre-C120 built-in themes keep their exact appearance", () => {
  const legacyPresets = [
    { opacity: 100, themeMode: "light", lightBackgroundColor: "#e4e5e9", lightTextColor: "#1c1c21", lightPulseColor: "#1f9d55", lightInkColor: "", darkBackgroundColor: "#1d1e22", darkTextColor: "#ececf0", darkPulseColor: "#3ae489", darkInkColor: "" },
    { opacity: 86, themeMode: "light", lightBackgroundColor: "#fafbfd", lightTextColor: "#16171c", lightPulseColor: "#16904c", lightInkColor: "", darkBackgroundColor: "#15161a", darkTextColor: "#f4f5f8", darkPulseColor: "#3ae489", darkInkColor: "" },
    { opacity: 90, themeMode: "light", lightBackgroundColor: "#f7f1e6", lightTextColor: "#2a2118", lightPulseColor: "#2f8f4e", lightInkColor: "#2a2118", darkBackgroundColor: "#1f1b17", darkTextColor: "#f5ecdc", darkPulseColor: "#7fdc8c", darkInkColor: "" },
  ];
  for (const saved of legacyPresets) {
    const loaded = normalizeSettings(saved);
    assert.equal(loaded.opacity, saved.opacity);
    assert.equal(loaded.themeMode, saved.themeMode);
    assert.equal(loaded.lightBackgroundColor, saved.lightBackgroundColor);
    assert.equal(loaded.lightTextColor, saved.lightTextColor);
    assert.equal(loaded.lightInkColor, saved.lightInkColor);
    assert.equal(loaded.darkBackgroundColor, saved.darkBackgroundColor);
    assert.equal(loaded.appearanceMode, "classic");
    assert.equal(loaded.fontFamily, "system");
    assert.equal(builtinThemeInUse(loaded), null);
  }
});
