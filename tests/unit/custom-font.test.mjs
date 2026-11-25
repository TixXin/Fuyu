import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SETTINGS, normalizeSettings, withThemeFrom } from "../../src/lib/settings/settings.ts";
import {
  MONO_FONT_STACK,
  PIXEL_FONT_STACK,
  ROUNDED_FONT_STACK,
  SERIF_FONT_STACK,
  SYSTEM_FONT_STACK,
  customFontFaceName,
  fontScaleCssValue,
  previewFontStackFor,
  uiFontStackFor,
} from "../../src/lib/theme/fonts.ts";
import { transformFontScaleCss } from "../../scripts/vite/font-scale.mjs";

test("custom font family, custom font id and font scale are normalized and carried with theme presets", () => {
  assert.equal(DEFAULT_SETTINGS.fontScale, 100);
  assert.equal(DEFAULT_SETTINGS.customFontId, "");
  assert.equal(normalizeSettings({}).fontScale, 100);
  assert.equal(normalizeSettings({ fontScale: 50 }).fontScale, 85);
  assert.equal(normalizeSettings({ fontScale: 200 }).fontScale, 125);
  assert.equal(normalizeSettings({ fontScale: 112.6 }).fontScale, 113);
  assert.equal(normalizeSettings({ fontScale: Number.NaN }).fontScale, 100);

  assert.equal(normalizeSettings({ fontFamily: "rounded" }).fontFamily, "rounded");
  assert.equal(normalizeSettings({ fontFamily: "serif" }).fontFamily, "serif");
  assert.equal(normalizeSettings({ fontFamily: "mono" }).fontFamily, "mono");
  assert.equal(normalizeSettings({ fontFamily: "comic" }).fontFamily, "system");
  assert.equal(normalizeSettings({ fontFamily: "custom", customFontId: "" }).fontFamily, "system");
  assert.equal(normalizeSettings({ fontFamily: "custom", customFontId: "../evil" }).fontFamily, "system");
  assert.equal(normalizeSettings({ fontFamily: "custom", customFontId: "../evil" }).customFontId, "");
  const custom = normalizeSettings({ fontFamily: "custom", customFontId: "lxgw-wenkai-1a2b" });
  assert.equal(custom.fontFamily, "custom");
  assert.equal(custom.customFontId, "lxgw-wenkai-1a2b");

  const reset = withThemeFrom(
    { ...DEFAULT_SETTINGS, fontFamily: "serif", fontScale: 120, customFontId: "lxgw-wenkai-1a2b" },
    DEFAULT_SETTINGS,
  );
  assert.equal(reset.fontFamily, "system");
  assert.equal(reset.fontScale, 100);
  assert.equal(reset.customFontId, "");
});

test("uiFontStackFor leaves system and pixel on default --font-ui and resolves custom stacks safely", () => {
  assert.equal(uiFontStackFor("system", ""), null);
  assert.equal(uiFontStackFor("pixel", ""), null);
  assert.equal(uiFontStackFor("rounded", ""), ROUNDED_FONT_STACK);
  assert.equal(uiFontStackFor("serif", ""), SERIF_FONT_STACK);
  assert.equal(uiFontStackFor("mono", ""), MONO_FONT_STACK);

  const loaded = new Set(["lxgw-1a"]);
  assert.equal(
    uiFontStackFor("custom", "lxgw-1a", loaded),
    `"${customFontFaceName("lxgw-1a")}", ${SYSTEM_FONT_STACK}`,
  );
  assert.equal(uiFontStackFor("custom", "missing-font", loaded), null);
  assert.equal(uiFontStackFor("custom", "../bad", loaded), null);
  assert.equal(previewFontStackFor({ fontFamily: "pixel", customFontId: "" }), PIXEL_FONT_STACK);
});

test("fontScaleCssValue omits default 100% and clamps out-of-range scales", () => {
  assert.equal(fontScaleCssValue(100), null);
  assert.equal(fontScaleCssValue(Number.NaN), null);
  assert.equal(fontScaleCssValue(85), "0.85");
  assert.equal(fontScaleCssValue(40), "0.85");
  assert.equal(fontScaleCssValue(125), "1.25");
  assert.equal(fontScaleCssValue(300), "1.25");
});

test("transformFontScaleCss scales literal px font sizes without breaking calc, line-height or comments", () => {
  const input = [
    ".a { font-size: 13px; color: red; }",
    ".b { font-size: 12.5px !important; }",
    ".c { font-size: 0px; }",
    ".d { font-size: calc(12 * var(--u)); }",
    ".e { font-size: 1.2em; }",
    ".f { font: 600 12px/1.5 var(--font-ui); }",
    ".g { font: 13px/1.35 var(--font-ui); }",
    "/* font-size: 14px; */",
  ].join("\n");

  const output = transformFontScaleCss(input);
  assert.match(output, /\.a \{ font-size: calc\(13px \* var\(--font-scale, 1\)\); color: red; \}/);
  assert.match(output, /\.b \{ font-size: calc\(12\.5px \* var\(--font-scale, 1\)\) !important; \}/);
  assert.match(output, /\.c \{ font-size: 0px; \}/);
  assert.match(output, /\.d \{ font-size: calc\(12 \* var\(--u\)\); \}/);
  assert.match(output, /\.e \{ font-size: 1\.2em; \}/);
  assert.match(output, /\.f \{ font: 600 calc\(12px \* var\(--font-scale, 1\)\)\/1\.5 var\(--font-ui\); \}/);
  assert.match(output, /\.g \{ font: calc\(13px \* var\(--font-scale, 1\)\)\/1\.35 var\(--font-ui\); \}/);
  assert.match(output, /\/\* font-size: 14px; \*\//);
});
