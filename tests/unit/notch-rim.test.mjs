import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SETTINGS, normalizeSettings } from "../../src/lib/settings/settings.ts";
import { NOTCH_RIM_SETTING_KEYS, NOTCH_RIM_STYLES, notchRimLook, withNotchRimLook } from "../../src/lib/settings/notchRimSettings.ts";
import { rimGeometry } from "../../src/windows/island/notch-rim/rimGeometry.ts";
import { rimPlan, rimShown } from "../../src/windows/island/notch-rim/rimLook.ts";

const BOX = { width: 340, height: 32, fillet: 6, corner: 14, k: 0.5523 };
const ACCENT = "#74d6ff";
const plan = (look, opts = {}) => rimPlan(look, { accent: ACCENT, status: null, motion: true, length: 400, width: 340, ripple: false, ...opts });
const islandLook = (patch) => ({ ...notchRimLook(DEFAULT_SETTINGS, "Island"), ...patch });

test("the notch border starts off for the island and the panel, status included, so upgrading changes nothing", () => {
  for (const target of ["Island", "Panel"]) {
    const look = notchRimLook(DEFAULT_SETTINGS, target);
    assert.equal(look.style, "off", target);
    assert.equal(look.status, false, target);
    assert.equal(rimShown(look, { color: "#ff9f0a", pulse: true }), false, `${target} stays dark even when an agent waits`);
  }
  assert.equal(DEFAULT_SETTINGS.notchRimPanelSame, false);
  const fromOld = normalizeSettings({ appearanceMode: "classic" });
  for (const key of NOTCH_RIM_SETTING_KEYS) assert.equal(fromOld[key], DEFAULT_SETTINGS[key], key);
});

test("stored notch border values are checked and fall back instead of breaking the island", () => {
  const settings = normalizeSettings({
    notchRimIslandStyle: "laser",
    notchRimIslandColor: "gold",
    notchRimIslandCustomColor: "red",
    notchRimIslandWidth: 2.3,
    notchRimIslandIntensity: 400,
    notchRimPanelWidth: 0.1,
    notchRimPanelIntensity: "70",
    notchRimPanelStyle: "comet",
    notchRimPanelStatus: true,
  });
  const island = notchRimLook(settings, "Island");
  assert.equal(island.style, "off");
  assert.equal(island.color, "accent");
  assert.equal(island.customColor, "#ffd60a");
  assert.equal(island.width, 2.5, "thickness snaps to the 0.5 px steps of the slider");
  assert.equal(island.intensity, 100);
  const panel = notchRimLook(settings, "Panel");
  assert.equal(panel.style, "comet");
  assert.equal(panel.width, 0.5);
  assert.equal(panel.intensity, 45);
  assert.equal(panel.status, true);
});

test("panel same as island reads the island's look and edits only touch their own target", () => {
  const edited = withNotchRimLook(DEFAULT_SETTINGS, "Island", { style: "aurora", width: 2 });
  assert.equal(notchRimLook(edited, "Panel").style, "off");
  const same = { ...edited, notchRimPanelSame: true };
  assert.deepEqual(notchRimLook(same, "Panel"), notchRimLook(same, "Island"));
  assert.equal(same.notchRimPanelStyle, "off", "the panel's own choice is kept for when the switch goes off again");
});

test("the rim path runs from the left curve tip around the bottom to the right curve tip", () => {
  const geometry = rimGeometry(BOX);
  assert.equal(geometry.boxWidth, BOX.width + 2 * BOX.fillet);
  assert.match(geometry.rim, /^M0 0 A6 6 0 0 1 6 6 /);
  assert.match(geometry.rim, / A6 6 0 0 1 352 0$/);
  assert.match(geometry.fill, / Z$/);
  assert.match(geometry.rimLeft, /L176 32$/);
  assert.match(geometry.rimRight, /^M352 0 .* L176 32$/);
  const shallow = rimGeometry({ ...BOX, height: 12, corner: 30 });
  assert.match(shallow.rim, /L6 6 C/, "a corner bigger than the island is clamped so the sides do not run backwards");
});

test("every style draws something except off, and only off draws nothing", () => {
  for (const style of NOTCH_RIM_STYLES) {
    const look = islandLook({ style });
    assert.equal(rimShown(look, null), style !== "off", style);
    assert.equal(plan(look).layers.length > 0, style !== "off", style);
  }
});

test("with reduced motion nothing loops and orbit, converge fall back to a still glow", () => {
  for (const style of NOTCH_RIM_STYLES) {
    const still = plan(islandLook({ style, status: true }), { motion: false, status: { color: "#ff9f0a", pulse: true }, ripple: true });
    assert.deepEqual(still.layers.filter((layer) => layer.animation), [], style);
    assert.equal(still.auroraFlow, false, style);
  }
  const comet = plan(islandLook({ style: "comet" }), { motion: false });
  assert.ok(comet.layers.some((layer) => layer.blur === "soft"), "orbit turns into a glow");
  assert.ok(!comet.layers.some((layer) => layer.dash), "no travelling dash is left");
  const switchedOff = plan(islandLook({ style: "twin", motion: false }));
  assert.deepEqual(switchedOff.layers.filter((layer) => layer.animation), [], "the motion switch stops it too");
});

test("follow status lights an off rim in the status colour and sweeps once when it arrives", () => {
  const look = islandLook({ status: true });
  const wait = { color: "#ff9f0a", pulse: true };
  assert.equal(rimShown(look, wait), true);
  const lit = plan(look, { status: wait, ripple: true });
  assert.ok(lit.layers.every((layer) => layer.color === "#ff9f0a"), "every layer uses the status colour");
  assert.ok(lit.layers.some((layer) => layer.animation === "pulse"), "a waiting agent flashes");
  assert.ok(lit.layers.some((layer) => layer.animation === "ripple"), "the arrival sweeps once");
  const message = plan(look, { status: { color: "#12b7f5" } });
  assert.ok(message.layers.some((layer) => layer.animation === "breathe"), "a message glows without flashing");
  assert.equal(rimShown(islandLook({ status: false }), wait), false, "with follow status off a status does not light it");
  assert.equal(plan(islandLook({ style: "hairline", color: "pink" }), { status: wait }).color, "#ff375f", "status off keeps the chosen colour");
});

test("the colour choice picks the accent, a fixed colour or the custom one", () => {
  assert.equal(plan(islandLook({ style: "glow", color: "accent" })).color, ACCENT);
  assert.equal(plan(islandLook({ style: "glow", color: "mint" })).color, "#63e6be");
  assert.equal(plan(islandLook({ style: "glow", color: "custom", customColor: "#123456" })).color, "#123456");
});
