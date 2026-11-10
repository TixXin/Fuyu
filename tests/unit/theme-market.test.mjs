import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SETTINGS } from "../../src/features/appearance/settings.ts";
import { isThemeInUse, readMarketThemes, withMarketTheme } from "../../src/features/theme-market/model.ts";

const midnight = { id: "focusd.midnight", name: { "zh-CN": "午夜蓝", en: "Midnight" }, author: "TixXin", appearance: { islandBackgroundColor: "#0f1a2e", islandCornerRadius: 28 } };

test("market entries are read only when they make sense", () => {
  const themes = readMarketThemes([
    midnight,
    midnight,
    { ...midnight, id: "Bad Id" },
    { ...midnight, id: "focusd.noname", name: {} },
    { ...midnight, id: "focusd.sizes", appearance: { collapsedScale: 1.3 } },
    "nope",
    { ...midnight, id: "focusd.en", name: { en: "Only English" } },
  ]);
  assert.deepEqual(themes.map((theme) => theme.id), ["focusd.midnight", "focusd.en"]);
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
});
