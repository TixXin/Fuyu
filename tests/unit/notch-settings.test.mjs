import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_NOTCH_RIM_SETTINGS, notchRimLook } from "../../src/lib/settings/notchRimSettings.ts";
import { defaultNotchRingSettings, notchRingLook } from "../../src/lib/settings/notchRingSettings.ts";
import {
  nearestWidthLevel,
  notchEditTarget,
  notchLights,
  notchLinked,
  notchShared,
  notchStyles,
  withNotchGap,
  withNotchLights,
  withNotchLinked,
  withNotchShared,
  withNotchStyle,
} from "../../src/lib/settings/notchSettingsModel.ts";

const defaults = { ...DEFAULT_NOTCH_RIM_SETTINGS, ...defaultNotchRingSettings(false) };
const looks = (settings) => [
  notchRimLook(settings, "Island"), notchRimLook(settings, "Panel"),
  notchRingLook(settings, "Island"), notchRingLook(settings, "Panel"),
];

test("the state switch decides which side a style goes to, until both sides are linked", () => {
  assert.equal(notchLinked(defaults), false);
  assert.equal(notchEditTarget(defaults, "collapsed"), "Island");
  assert.equal(notchEditTarget(defaults, "expanded"), "Panel");
  const panelGlow = withNotchStyle(defaults, "ring", "expanded", "glow");
  assert.deepEqual(notchStyles(panelGlow, "expanded"), { rim: "off", ring: "glow" });
  assert.deepEqual(notchStyles(panelGlow, "collapsed"), { rim: "off", ring: "off" }, "the collapsed island is untouched");
});

test("linking makes the panel follow the island for both layers, and editing either state changes both", () => {
  const linked = withNotchLinked(defaults, true);
  assert.equal(notchLinked(linked), true);
  assert.equal(linked.notchRimPanelSame && linked.notchRingPanelSame, true, "one link button stands for both old \"panel same as island\" switches");
  const edited = withNotchStyle(linked, "rim", "expanded", "aurora");
  assert.equal(notchStyles(edited, "collapsed").rim, "aurora");
  assert.equal(notchStyles(edited, "expanded").rim, "aurora");
  assert.equal(notchLinked({ ...linked, notchRingPanelSame: false }), false, "half-linked old data shows as not linked");
});

test("linking while looking at the expanded side keeps the panel's look for both sides", () => {
  const panelGlow = withNotchStyle(defaults, "ring", "expanded", "glow");
  const fromPanel = withNotchLinked(panelGlow, true, "expanded");
  assert.deepEqual(notchStyles(fromPanel, "expanded"), { rim: "off", ring: "glow" }, "what you were looking at does not jump");
  assert.deepEqual(notchStyles(fromPanel, "collapsed"), { rim: "off", ring: "glow" });
  assert.deepEqual(notchStyles(withNotchLinked(panelGlow, true, "collapsed"), "expanded").ring, "off", "from the collapsed side the island's look wins");
});

test("unlinking keeps what the panel showed, then the two sides go their own way", () => {
  const linked = withNotchStyle(withNotchLinked(defaults, true), "ring", "collapsed", "scan");
  const apart = withNotchLinked(linked, false);
  assert.equal(notchLinked(apart), false);
  assert.deepEqual(notchStyles(apart, "expanded"), notchStyles(linked, "expanded"), "nothing jumps when the link is cut");
  const panelOnly = withNotchStyle(apart, "ring", "expanded", "beat");
  assert.equal(notchStyles(panelOnly, "collapsed").ring, "scan");
  assert.equal(notchStyles(panelOnly, "expanded").ring, "beat");
});

test("colour, width, brightness and motion are one setting for both layers and both states", () => {
  const shared = withNotchShared(defaults, { color: "custom", customColor: "#ff00aa", width: 2.5, intensity: 30, motion: false });
  for (const look of looks(shared)) {
    assert.equal(look.color, "custom");
    assert.equal(look.customColor, "#ff00aa");
    assert.equal(look.width, 2.5);
    assert.equal(look.intensity, 30);
    assert.equal(look.motion, false);
  }
  assert.deepEqual(notchShared(shared), { color: "custom", customColor: "#ff00aa", width: 2.5, intensity: 30, motion: false });
});

test("a newly picked style is drawn in the colour the swatches show, even where the old defaults differed", () => {
  assert.notEqual(notchRimLook(defaults, "Island").color, notchShared(defaults).color, "the old border and ring defaults disagree");
  const rim = withNotchStyle(defaults, "rim", "collapsed", "glow");
  const look = notchRimLook(rim, "Island");
  assert.equal(look.color, notchShared(defaults).color);
  assert.equal(look.width, notchShared(defaults).width);
  assert.equal(look.intensity, notchShared(defaults).intensity);
});

test("camera and mic light only the ring; messages and agents light the ring and recolour the border", () => {
  assert.deepEqual(notchLights(defaults), { device: true, status: false });
  const noDevice = withNotchLights(defaults, { device: false });
  assert.equal(notchRingLook(noDevice, "Island").device, false);
  assert.equal(notchRingLook(noDevice, "Panel").device, false);
  const status = withNotchLights(defaults, { status: true });
  for (const look of looks(status)) assert.equal(look.status, true);
  assert.equal(notchRingLook(status, "Island").device, true, "turning messages on leaves the camera light alone");
});

test("the gap moves the ring on both sides", () => {
  const moved = withNotchGap(defaults, 5);
  assert.equal(notchRingLook(moved, "Island").gap, 5);
  assert.equal(notchRingLook(moved, "Panel").gap, 5);
});

test("old widths land on the nearest of thin, medium and thick", () => {
  assert.equal(nearestWidthLevel(0.5), "thin");
  assert.equal(nearestWidthLevel(1), "thin");
  assert.equal(nearestWidthLevel(1.5), "medium");
  assert.equal(nearestWidthLevel(2), "medium");
  assert.equal(nearestWidthLevel(3), "thick");
});
