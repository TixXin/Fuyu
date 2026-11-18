import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SETTINGS } from "../../src/lib/settings/settings.ts";
import { parseTheme } from "../../src/lib/theme/theme.ts";
import { isDualMarketTheme, isThemeInUse, readMarketThemes, withMarketTheme } from "../../src/features/theme-market/model.ts";

const midnight = { id: "fuyu.midnight", name: { "zh-CN": "午夜蓝", en: "Midnight" }, author: "TixXin", appearance: { islandBackgroundColor: "#0f1a2e", islandCornerRadius: 28 } };
const polar = {
  id: "fuyu.polar",
  name: { "zh-CN": "极光霜", en: "Polar" },
  author: "TixXin",
  appearance: {
    opacity: 92,
    dark: { islandBackgroundColor: "#141b26", taskTextColor: "#edf2fa", pulseColor: "#4ee0a0" },
    light: { islandBackgroundColor: "#eef3fa", taskTextColor: "#18212e", pulseColor: "#188f59", inkColor: "#18212e" },
  },
};

test("market entries are read only when they make sense", () => {
  const themes = readMarketThemes([
    midnight,
    midnight,
    { ...midnight, id: "Bad Id" },
    { ...midnight, id: "fuyu.noname", name: {} },
    { ...midnight, id: "fuyu.sizes", appearance: { collapsedScale: 1.3 } },
    "nope",
    { ...midnight, id: "fuyu.en", name: { en: "Only English" } },
  ]);
  assert.deepEqual(themes.map((theme) => theme.id), ["fuyu.midnight", "fuyu.en"]);
  assert.equal(themes[1].name["zh-CN"], "Only English");
});

test("a market theme changes the look only, with checked values", () => {
  const [theme] = readMarketThemes([{ ...midnight, appearance: { ...midnight.appearance, collapsedScale: 1.3, pulseColor: "red" } }]);
  const mine = { ...DEFAULT_SETTINGS, collapsedScale: 1.1, showTitle: true };
  const next = withMarketTheme(mine, theme);
  assert.equal(next.islandBackgroundColor, "#0f1a2e");
  assert.equal(next.islandCornerRadius, 28);
  assert.equal(next.collapsedScale, 1.1, "sizes are not part of a theme");
  assert.equal(next.showTitle, true);
  assert.equal(next.pulseColor, mine.pulseColor, "an invalid colour is not taken");
  assert.equal(isThemeInUse(mine, theme), false);
  assert.equal(isThemeInUse(next, theme), true);
  assert.equal(isDualMarketTheme(theme), false);
});

test("a dual-tone market theme carries both dark and light sets and keeps system or chosen mode (C33.7)", () => {
  const [nested, flat, brokenDual, lightOnly] = readMarketThemes([
    polar,
    {
      id: "fuyu.flat-dual",
      name: { "zh-CN": "双色平面", en: "Flat dual" },
      author: "TixXin",
      appearance: { darkBackgroundColor: "#181a20", lightBackgroundColor: "#f3f5f9" },
    },
    {
      id: "fuyu.bad-dual",
      name: { "zh-CN": "坏双色", en: "Bad dual" },
      author: "TixXin",
      appearance: { darkBackgroundColor: "nope", lightBackgroundColor: "#f3f5f9" },
    },
    {
      id: "fuyu.paper",
      name: { "zh-CN": "纸白", en: "Paper" },
      author: "someone",
      appearance: { light: { islandBackgroundColor: "#f7f3e8", taskTextColor: "#222222", pulseColor: "#d4502a" } },
    },
  ]);

  assert.equal(isDualMarketTheme(nested), true);
  assert.equal(isDualMarketTheme(flat), true);
  assert.equal(isDualMarketTheme(brokenDual), false);
  assert.equal(isDualMarketTheme(lightOnly), false);

  const systemUser = { ...DEFAULT_SETTINGS, themeMode: "system", darkInkColor: "#ffd9a0" };
  const applied = withMarketTheme(systemUser, nested);
  assert.equal(applied.themeMode, "system", "applying a dual-tone theme keeps Follow system");
  assert.equal(applied.darkBackgroundColor, "#141b26");
  assert.equal(applied.darkTextColor, "#edf2fa");
  assert.equal(applied.darkPulseColor, "#4ee0a0");
  assert.equal(applied.darkInkColor, "", "previous custom ink does not leak into omitted tone ink");
  assert.equal(applied.lightBackgroundColor, "#eef3fa");
  assert.equal(applied.lightTextColor, "#18212e");
  assert.equal(applied.lightPulseColor, "#188f59");
  assert.equal(applied.lightInkColor, "#18212e");
  assert.equal(applied.opacity, 92);

  assert.equal(isThemeInUse(applied, nested), true);
  assert.equal(isThemeInUse({ ...applied, themeMode: "dark" }, nested), true);
  assert.equal(isThemeInUse({ ...applied, themeMode: "light" }, nested), true);
  assert.equal(isThemeInUse({ ...applied, lightBackgroundColor: "#ffffff" }, nested), false);

  const appliedPaper = withMarketTheme({ ...DEFAULT_SETTINGS, themeMode: "dark" }, lightOnly);
  assert.equal(appliedPaper.themeMode, "light");
  assert.equal(appliedPaper.lightBackgroundColor, "#f7f3e8");
  assert.equal(appliedPaper.islandBackgroundColor, "#f7f3e8");

  const imported = parseTheme(JSON.stringify({ app: "fuyu", kind: "theme", version: 1, name: "Polar", appearance: polar.appearance }), systemUser);
  assert.ok("settings" in imported);
  assert.equal(imported.settings.themeMode, "system");
  assert.equal(imported.settings.darkBackgroundColor, "#141b26");
  assert.equal(imported.settings.lightBackgroundColor, "#eef3fa");
});
