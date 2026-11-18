import assert from "node:assert/strict";
import test from "node:test";
import { relativeLuminance } from "../../src/utils/color.ts";
import { DEFAULT_GLASS_SETTINGS, normalizeGlassSettings } from "../../src/lib/settings/glassSettings.ts";
import {
  GLASS_DARK_MAX_LUMINANCE,
  GLASS_LIGHT_MIN_LUMINANCE,
  glassClassNames,
  glassPalette,
  glassPaused,
  glassVariables,
  guardColor,
} from "../../src/lib/theme/glassPalette.ts";

const contrast = (a, b) => {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const over = (ink, alpha, background) => {
  const channels = [1, 3, 5].map((start) => Number.parseInt(background.slice(start, start + 2), 16));
  return `#${channels.map((value, index) => Math.round(ink[index] * alpha + value * (1 - alpha)).toString(16).padStart(2, "0")).join("")}`;
};
const secondaryContrast = (blob, light) => contrast(over(light ? [24, 24, 30] : [241, 240, 246], light ? 0.7 : 0.68, blob), blob);

const ACCENTS = ["#74d6ff", "#0a7fd1", "#ffb020", "#22d3a0", "#ff4fa3", "#ffffff", "#000000"];

test("the contrast guard keeps blobs dark on a dark island and light on a light island", () => {
  for (const accent of ACCENTS) {
    const dark = glassPalette({ settings: DEFAULT_GLASS_SETTINGS, accent, cover: null, background: "#030303" });
    const light = glassPalette({ settings: DEFAULT_GLASS_SETTINGS, accent, cover: null, background: "#f6f6f8" });
    for (const color of dark) {
      assert.ok(relativeLuminance(color) <= GLASS_DARK_MAX_LUMINANCE + 1e-6, `${accent} → ${color}`);
      assert.ok(secondaryContrast(color, false) >= 3, `secondary text on ${color}`);
    }
    for (const color of light) {
      assert.ok(relativeLuminance(color) >= GLASS_LIGHT_MIN_LUMINANCE - 1e-6, `${accent} → ${color}`);
      assert.ok(secondaryContrast(color, true) >= 3, `secondary text on ${color}`);
    }
  }
});

test("the guard takes an outside background luminance so a wallpaper layer can reuse it", () => {
  assert.ok(relativeLuminance(guardColor("#74d6ff", 0.02)) <= GLASS_DARK_MAX_LUMINANCE + 1e-6);
  assert.ok(relativeLuminance(guardColor("#0a7fd1", 0.8)) >= GLASS_LIGHT_MIN_LUMINANCE - 1e-6);
  const palette = glassPalette({ settings: DEFAULT_GLASS_SETTINGS, accent: "#74d6ff", cover: null, background: "#030303", backgroundLuminance: 0.9 });
  assert.ok(palette.every((color) => relativeLuminance(color) >= GLASS_LIGHT_MIN_LUMINANCE - 1e-6));
});

test("colour sources: theme accent, cover while playing, custom colours", () => {
  const base = { ...DEFAULT_GLASS_SETTINGS, glassContrastGuard: false };
  assert.equal(glassPalette({ settings: base, accent: "#ff4fa3", cover: null, background: "#030303" })[0], "#ff4fa3");
  assert.equal(glassPalette({ settings: base, accent: null, cover: null, background: "#030303" })[0], "#74d6ff");
  assert.equal(glassPalette({ settings: base, accent: null, cover: null, background: "#ffffff" })[0], "#0a7fd1");
  const cover = { ...base, glassColorSource: "cover" };
  assert.equal(glassPalette({ settings: cover, accent: "#ff4fa3", cover: "#22d3a0", background: "#030303" })[0], "#22d3a0");
  assert.equal(glassPalette({ settings: cover, accent: "#ff4fa3", cover: null, background: "#030303" })[0], "#ff4fa3");
  const custom = { ...base, glassColorSource: "custom", glassColor1: "#112233", glassColor3: "#445566" };
  const palette = glassPalette({ settings: custom, accent: "#ff4fa3", cover: null, background: "#030303" });
  assert.equal(palette[0], "#112233");
  assert.notEqual(palette[1], "");
  assert.equal(palette[2], "#445566");
});

test("the flow pauses when tucked, quiet, hidden, reduced motion or collapsed in expanded-only mode", () => {
  const running = { mode: "collapsed", isTucked: false, quiet: false, hidden: false, reducedMotion: false };
  const always = { ...DEFAULT_GLASS_SETTINGS, glassFlowWhen: "always" };
  assert.equal(glassPaused(always, running), false);
  for (const key of ["isTucked", "quiet", "hidden", "reducedMotion"]) {
    assert.equal(glassPaused(always, { ...running, [key]: true }), true, key);
  }
  const expandedOnly = DEFAULT_GLASS_SETTINGS;
  assert.equal(glassPaused(expandedOnly, running), true);
  assert.equal(glassPaused(expandedOnly, { ...running, mode: "expanded" }), false);
  assert.equal(glassPaused({ ...DEFAULT_GLASS_SETTINGS, glassFlowSpeed: 0 }, running), true);
  assert.equal(glassPaused({ ...DEFAULT_GLASS_SETTINGS, glassStyle: "static" }, running), true);
});

test("variables and class names follow the settings", () => {
  const vars = glassVariables({ ...DEFAULT_GLASS_SETTINGS, glassFlowSpeed: 200, glassBlobScale: 60 }, ["#000001", "#000002", "#000003"]);
  assert.equal(vars["--glass-c2"], "#000002");
  assert.equal(vars["--glass-flow-duration"], "11.50s");
  assert.equal(vars["--glass-blob-scale"], "0.6");
  assert.equal(vars["--glass-color-strength"], "0.3");
  assert.equal(vars["--glass-blur"], "24px");
  const names = glassClassNames({ ...DEFAULT_GLASS_SETTINGS, glassRim: true }, true).split(" ");
  assert.deepEqual(names.sort(), [
    "island--glass-morph-smooth",
    "island--glass-paused",
    "island--glass-rim",
    "island--glass-specular",
    "island--glass-style-flow",
  ]);
  const hiddenNames = glassClassNames({ ...DEFAULT_GLASS_SETTINGS, glassRim: true }, true, true).split(" ");
  assert.deepEqual(hiddenNames.sort(), [
    "island--glass-hidden",
    "island--glass-morph-smooth",
    "island--glass-paused",
    "island--glass-rim",
    "island--glass-specular",
    "island--glass-style-flow",
  ]);
});

test("old settings without the new fields read the defaults", () => {
  assert.deepEqual(normalizeGlassSettings({}), DEFAULT_GLASS_SETTINGS);
  assert.deepEqual(normalizeGlassSettings(null), DEFAULT_GLASS_SETTINGS);
  assert.equal(normalizeGlassSettings({ glassStyle: "neon", glassFlowSpeed: 999 }).glassStyle, "flow");
  assert.equal(normalizeGlassSettings({ glassFlowSpeed: 999 }).glassFlowSpeed, 200);
  assert.equal(normalizeGlassSettings({ glassBackdrop: "native" }).glassBackdrop, "native");
  assert.equal(normalizeGlassSettings({ glassBackdrop: "none" }).glassBackdrop, "none");
  assert.equal(normalizeGlassSettings({ glassBackdrop: "acrylic" }).glassBackdrop, DEFAULT_GLASS_SETTINGS.glassBackdrop);
});
