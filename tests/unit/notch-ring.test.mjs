import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_NOTCH_RING_SETTINGS,
  normalizeNotchRingSettings,
  notchRingExtra,
  notchRingLook,
  withNotchRingLook,
} from "../../src/lib/settings/notchRingSettings.ts";
import { ringGeometry } from "../../src/windows/island/notch-ring/ringGeometry.ts";
import { ringPlan } from "../../src/windows/island/notch-ring/ringPlan.ts";

const camera = { color: "#30d158", reason: "device-use.camera" };
const message = { color: "#12b7f5", reason: "messages.qq" };
const plan = (look, extra = {}) => ringPlan({ ...notchRingLook(DEFAULT_NOTCH_RING_SETTINGS, "Island"), ...look }, { accent: "#0a84ff", glow: null, playback: null, motion: true, now: 0, ...extra });

test("an upgraded user sees no ring until the camera or mic is on", () => {
  const settings = normalizeNotchRingSettings({});
  assert.equal(settings.notchRingIslandStyle, "off");
  assert.equal(settings.notchRingPanelStyle, "off");
  assert.equal(settings.notchRingIslandBottom, "sides");
  assert.equal(plan({}), null);
  assert.equal(plan({}, { glow: message }), null, "messages only light the ring when that switch is on");
  assert.equal(plan({}, { glow: camera }).color, "#30d158");
  assert.equal(plan({ device: false }, { glow: camera }), null);
});

test("saved values are kept and broken ones fall back", () => {
  const settings = normalizeNotchRingSettings({
    notchRingIslandStyle: "scan",
    notchRingIslandWidth: 9,
    notchRingIslandGap: 2.6,
    notchRingIslandCustomColor: "red",
    notchRingIslandDevice: false,
    notchRingPanelStyle: "nope",
    notchRingPanelSame: true,
    notchRingIslandBottom: "full",
  });
  assert.equal(settings.notchRingIslandStyle, "scan");
  assert.equal(settings.notchRingIslandWidth, 3);
  assert.equal(settings.notchRingIslandGap, 3);
  assert.equal(settings.notchRingIslandCustomColor, DEFAULT_NOTCH_RING_SETTINGS.notchRingIslandCustomColor);
  assert.equal(settings.notchRingIslandDevice, false);
  assert.equal(settings.notchRingPanelStyle, "off");
  assert.equal(notchRingLook(settings, "Panel").style, "scan", "the panel follows the island when asked to");
  assert.equal(settings.notchRingIslandBottom, "full");
});

test("only a drawn full ring grows the collapsed island, by enough room for gap and line", () => {
  const sides = withNotchRingLook(DEFAULT_NOTCH_RING_SETTINGS, "Island", { style: "glow", gap: 2, width: 1 });
  assert.equal(notchRingExtra(sides, false), 0);
  const full = { ...sides, notchRingIslandBottom: "full" };
  assert.equal(notchRingExtra(full, false), 5);
  assert.equal(notchRingExtra(full, false, 0.8), 7, "the extra is in unscaled layer units");
  const off = withNotchRingLook(full, "Island", { style: "off" });
  assert.equal(notchRingExtra(off, false), 0);
  assert.equal(notchRingExtra(off, true), 5, "a lit ring still needs the room");
});

test("music styles need playback and moving styles need motion", () => {
  assert.equal(plan({ style: "progress" }).style, "hairline");
  assert.equal(plan({ style: "beat" }).style, "hairline");
  const playing = plan({ style: "progress" }, { playback: { startedAt: 1000, durationMs: 10_000 }, now: 4000 });
  assert.deepEqual(playing.progress, { durationMs: 10_000, elapsedMs: 3000 });
  assert.equal(plan({ style: "progress" }, { playback: { startedAt: 0, durationMs: 1000 }, now: 9000 }).progress.elapsedMs, 1000);
  assert.equal(plan({ style: "scan" }, { motion: false }).style, "glow");
  assert.equal(plan({ style: "aurora" }, { motion: false }).auroraFlow, false);
  assert.ok(plan({ style: "ticks" }, { motion: false }).layers.every((layer) => layer.animation === undefined));
});

test("a waiting agent pulses in its own colour over the chosen style", () => {
  const lit = plan({ style: "hairline", status: true }, { glow: { color: "#ff9f43", reason: "agent-status.waiting", pulse: true } });
  assert.equal(lit.style, "glow");
  assert.equal(lit.color, "#ff9f43");
  assert.ok(lit.layers.some((layer) => layer.animation === "pulse"));
  assert.equal(plan({ style: "glow", color: "accent" }).color, "#0a84ff");
});

test("the ring hugs the notch: both ends on the screen edge, bottom one gap below it", () => {
  const geometry = ringGeometry(186, 32, 3);
  const ends = [...geometry.ring.matchAll(/(-?[\d.]+) (-?[\d.]+)(?= [AL]|$)/g)].map((match) => [Number(match[1]), Number(match[2])]);
  assert.equal(geometry.ring.startsWith("M"), true);
  assert.equal(ends.at(-1)[1], 0, "the ring ends at the top edge");
  assert.match(geometry.ring, /^M[\d.]+ 0 /, "the ring starts at the top edge");
  assert.equal(geometry.bottom, 35);
  assert.equal(geometry.mid, geometry.width / 2, "centred on the notch");
  assert.equal(ringGeometry(0, 32, 2), null);
  assert.equal(ringGeometry(186, Number.NaN, 2), null);
});
