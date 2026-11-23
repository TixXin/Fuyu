import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SETTINGS, THEME_SETTING_KEYS, withPresetFrom } from "../../src/lib/settings/settings.ts";
import { buildTheme, parseTheme, themeFileName } from "../../src/lib/theme/theme.ts";

const current = { ...DEFAULT_SETTINGS, opacity: 80, pulseColor: "#112233" };

test("a theme holds the preset's name and only its look", () => {
  const theme = buildTheme("Night", { ...current, gameAutoTuck: true }, new Date("2026-11-08T06:30:00Z"));
  assert.equal(theme.app, "fuyu");
  assert.equal(theme.kind, "theme");
  assert.equal(theme.version, 1);
  assert.equal(theme.name, "Night");
  assert.equal(theme.exportedAt, "2026-11-08T06:30:00.000Z");
  assert.deepEqual(Object.keys(theme.appearance).sort(), [...THEME_SETTING_KEYS].sort());
  assert.ok(!("collapsedScale" in theme.appearance) && !("showTitle" in theme.appearance), "sizes and display stay out (C26)");
  assert.equal(theme.appearance.opacity, 80);
  assert.ok(!("gameAutoTuck" in theme.appearance));
});

test("a theme file carries the jellyfish look only when asked to, and an import without one leaves the look alone", () => {
  const plain = buildTheme("Night", { ...current, jellyfishStyle: "fine" }, new Date());
  assert.ok(!("jellyfishStyle" in plain.appearance), "a market theme saved as a preset does not pick up the user's look");
  const pixel = buildTheme("Night", current, new Date(), "neon");
  assert.equal(pixel.appearance.jellyfishStyle, "neon");
  const mine = { ...current, jellyfishStyle: "flat" };
  const fromPlain = parseTheme(JSON.stringify(plain), mine);
  assert.ok(!("jellyfishStyle" in fromPlain));
  assert.equal(fromPlain.settings.jellyfishStyle, "flat");
  assert.equal(parseTheme(JSON.stringify(pixel), mine).jellyfishStyle, "neon");
  const unknown = { ...pixel, appearance: { ...pixel.appearance, jellyfishStyle: "blurry" } };
  assert.ok(!("jellyfishStyle" in parseTheme(JSON.stringify(unknown), mine)), "a look this version does not know is dropped");
});

test("applying a preset changes the jellyfish look only when the preset carries one", () => {
  const mine = { ...current, jellyfishStyle: "flat", collapsedScale: 1.1 };
  const old = { id: "a", name: "Old", settings: { ...DEFAULT_SETTINGS, opacity: 55, jellyfishStyle: "vector" }, createdAt: 1 };
  const next = withPresetFrom(mine, old);
  assert.equal(next.opacity, 55);
  assert.equal(next.collapsedScale, 1.1, "sizes are still not part of a preset's look");
  assert.equal(next.jellyfishStyle, "flat", "a preset saved before looks existed keeps the user's look");
  assert.equal(withPresetFrom(mine, { ...old, jellyfishStyle: "neon" }).jellyfishStyle, "neon");
  assert.equal(withPresetFrom(mine, { ...old, jellyfishStyle: "blurry" }).jellyfishStyle, "flat");
});

test("theme files are named by local date and time", () => {
  assert.equal(themeFileName(new Date(2026, 10, 8, 9, 5)), "fuyu-theme-2026-11-08-0905.json");
});

test("importing round-trips a theme over the current settings", () => {
  const exported = buildTheme("Night", { ...current, themeMode: "dark", opacity: 60, darkPulseColor: "#abcdef" }, new Date());
  const parsed = parseTheme("\uFEFF" + JSON.stringify(exported), { ...current, gameAutoTuck: true });
  assert.ok(!("problem" in parsed));
  assert.equal(parsed.name, "Night");
  assert.equal(parsed.settings.opacity, 60);
  assert.equal(parsed.settings.darkPulseColor, "#abcdef");
  assert.equal(exported.appearance.pulseColor, "#abcdef", "older islands read the single colour");
  assert.equal(parsed.settings.gameAutoTuck, true);
});

test("importing checks every value and ignores fields outside the appearance", () => {
  const file = {
    app: "fly-island",
    kind: "theme",
    version: 1,
    name: "  " + "x".repeat(100) + "  ",
    appearance: { pulseColor: "red; background:url(x)", opacity: "loud", gameAutoTuck: true },
  };
  const parsed = parseTheme(JSON.stringify(file), current);
  assert.ok(!("problem" in parsed));
  assert.equal(parsed.name.length, 60);
  assert.match(parsed.settings.pulseColor, /^#[0-9a-f]{6}$/i);
  assert.equal(typeof parsed.settings.opacity, "number");
  assert.equal(parsed.settings.gameAutoTuck, current.gameAutoTuck);
});

test("importing refuses files that are not themes", () => {
  assert.deepEqual(parseTheme("nope", current), { problem: "notJson" });
  assert.deepEqual(parseTheme("[]", current), { problem: "notTheme" });
  assert.deepEqual(parseTheme(JSON.stringify({ app: "fly-island", version: 1, keys: {} }), current), { problem: "notTheme" });
  assert.deepEqual(
    parseTheme(JSON.stringify({ app: "fly-island", kind: "theme", version: 2, appearance: {} }), current),
    { problem: "newerVersion" },
  );
});

test("an older theme file with sizes changes only the look (C26)", () => {
  const mine = { ...current, collapsedScale: 1.2, panelWidth: 640, showTitle: true };
  const old = { app: "fly-island", kind: "theme", version: 1, name: "Old", appearance: { opacity: 55, collapsedScale: 0.8, panelWidth: 480, showTitle: false } };
  const parsed = parseTheme(JSON.stringify(old), mine);
  assert.ok(!("problem" in parsed));
  assert.equal(parsed.settings.opacity, 55);
  assert.equal(parsed.settings.collapsedScale, 1.2);
  assert.equal(parsed.settings.panelWidth, 640);
  assert.equal(parsed.settings.showTitle, true);
});
