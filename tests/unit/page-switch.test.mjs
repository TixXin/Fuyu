import assert from "node:assert/strict";
import test from "node:test";
import {
  CAROUSEL_EFFECTS, PAGE_SWITCH_EFFECTS, indicatorDuration, indicatorFrames, overlayLayers, pageLayers, pageSwitchSpeed, resolveIndicator, resolvePageSwitch, switchOrigin,
} from "../../src/lib/theme/pageSwitch.ts";
import { normalizeSettings } from "../../src/lib/settings/settings.ts";

const box = { width: 560, height: 300 };
const request = (effect, extra = {}) => ({ effect, direction: 1, axis: "x", box, origin: null, speed: 1, random: () => 0.5, ...extra });
const kinds = PAGE_SWITCH_EFFECTS.filter((effect) => effect !== "carousel");

test("page switch settings default to the curtain and a stretching highlight, and fall back on unknown values", () => {
  const fresh = normalizeSettings({});
  assert.equal(fresh.pageSwitchPanel, "wipe");
  assert.equal(fresh.pageSwitchSettings, "wipe");
  assert.equal(fresh.pageSwitchIndicator, "stretch");
  assert.equal(fresh.pageSwitchSpeed, "normal");
  assert.equal(fresh.pageSwitchDirectional, true);
  const odd = normalizeSettings({ pageSwitchPanel: "flip", pageSwitchSettings: "slide", pageSwitchIndicator: "pill", pageSwitchSpeed: 3, pageSwitchDirectional: false });
  assert.equal(odd.pageSwitchPanel, "wipe");
  assert.equal(odd.pageSwitchSettings, "wipe");
  assert.equal(odd.pageSwitchIndicator, "stretch");
  assert.equal(odd.pageSwitchSpeed, "normal");
  assert.equal(odd.pageSwitchDirectional, false);
});

test("text on the incoming page only fades or is revealed by a mask that leaves clicks alone, never moves, scales or blurs", () => {
  for (const effect of kinds) {
    for (const direction of [-1, 0, 1]) {
      for (const layer of pageLayers(request(effect, { direction }))) {
        for (const frame of layer.frames) {
          for (const key of Object.keys(frame)) assert.ok(key === "opacity" || key === "offset" || key === "easing" || /^(webkitM|m)ask[A-Z]/.test(key), `${effect} animates ${key}`);
        }
      }
    }
  }
});

test("shuffle cycles through every effect and reduced motion falls back to a fade", () => {
  const seen = new Set(CAROUSEL_EFFECTS.map((_, turn) => resolvePageSwitch("carousel", turn, false)));
  assert.deepEqual([...seen].sort(), [...CAROUSEL_EFFECTS].sort());
  assert.ok(!seen.has("none"));
  for (const effect of PAGE_SWITCH_EFFECTS) {
    assert.equal(resolvePageSwitch(effect, 0, true), effect === "none" ? "none" : "fade");
  }
  assert.equal(resolveIndicator("stretch", true), "jump");
  assert.equal(resolveIndicator("slide", false), "slide");
});

test("a ripple grows from where you clicked until it covers the farthest corner", () => {
  const [layer] = pageLayers(request("ripple", { origin: { x: 40, y: -20 } }));
  const [first, last] = layer.frames;
  assert.equal(first.maskSize, "0px 0px");
  assert.equal(first.maskPosition, "40px -20px");
  const diameter = Number(/^(\d+)px/.exec(last.maskSize)[1]);
  assert.ok(diameter / 2 >= Math.hypot(560 - 40, 300 + 20), last.maskSize);
  assert.equal(last.maskPosition, `${40 - diameter / 2}px ${-20 - diameter / 2}px`);
});

test("keyboard turns start from the side you are heading to, or the middle when direction is off", () => {
  assert.deepEqual(switchOrigin({ direction: 1, axis: "x", box, origin: null }), { x: 560, y: 150 });
  assert.deepEqual(switchOrigin({ direction: -1, axis: "y", box, origin: null }), { x: 280, y: 0 });
  assert.deepEqual(switchOrigin({ direction: 0, axis: "x", box, origin: null }), { x: 280, y: 150 });
  const wipe = (extra) => pageLayers(request("wipe", extra))[0].frames.map((frame) => `${frame.maskSize} @ ${frame.maskPosition}`);
  const image = (extra) => pageLayers(request("wipe", extra))[0].frames[0].maskImage;
  assert.deepEqual(wipe({ direction: 1 }), ["200% 100% @ 0% 0%", "200% 100% @ 100% 0%"]);
  assert.equal(image({ direction: 1 }), "linear-gradient(to right, transparent 50%, #000 50%)");
  assert.deepEqual(wipe({ direction: -1 }), ["200% 100% @ 100% 0%", "200% 100% @ 0% 0%"]);
  assert.equal(image({ direction: -1 }), "linear-gradient(to right, #000 50%, transparent 50%)");
  assert.deepEqual(wipe({ direction: 1, axis: "y" }), ["100% 200% @ 0% 0%", "100% 200% @ 0% 100%"]);
  assert.equal(image({ direction: 1, axis: "y" }), "linear-gradient(to bottom, transparent 50%, #000 50%)");
  assert.deepEqual(wipe({ direction: 0 }), ["0% 100% @ 50% 50%", "100% 100% @ 50% 50%"]);
  assert.equal(overlayLayers(request("wipe", { direction: 0 })).length, 2);
  assert.equal(overlayLayers(request("wipe", { direction: 1 })).length, 1);
});

test("the curtain, its edge line, the sheen and the pixels are sized in percent, so a panel that changes size mid-switch is still fully revealed", () => {
  for (const effect of ["wipe", "pixel", "sheen"]) {
    for (const direction of [-1, 0, 1]) {
      for (const axis of ["x", "y"]) {
        const layers = [...pageLayers(request(effect, { direction, axis })), ...overlayLayers(request(effect, { direction, axis })).map((overlay) => overlay.layer)];
        for (const layer of layers) {
          for (const frame of layer.frames) {
            for (const [key, value] of Object.entries(frame)) assert.ok(typeof value !== "string" || !/\d+px/.test(value.replace(/calc\([\d.]+% [-+] \dpx\)/g, "")), `${effect} ${direction} ${axis}: ${key} ${value}`);
          }
        }
      }
    }
  }
});

test("pixel dissolve only ever adds cells, starts empty, ends covering the page, and sweeps the way you turn", () => {
  const forward = pageLayers(request("pixel", { random: () => 0 }))[0].frames;
  const shown = (frame) => (frame.maskImage.includes("transparent") ? [] : frame.maskPosition.split(", "));
  assert.deepEqual(shown(forward[0]), []);
  for (let index = 1; index < forward.length - 1; index += 1) {
    for (const cell of shown(forward[index - 1])) assert.ok(shown(forward[index]).includes(cell), `frame ${index} drops ${cell}`);
  }
  for (const frame of forward.slice(0, -1)) assert.equal(frame.easing, "steps(1, end)", "cells jump in, they never slide between frames");
  const last = forward.at(-1);
  assert.equal(`${last.maskSize} @ ${last.maskPosition}`, "100% 100% @ 0% 0%");
  const firstCell = (frames) => Number.parseFloat(shown(frames[1])[0]);
  const backward = pageLayers(request("pixel", { random: () => 0, direction: -1 }))[0].frames;
  assert.equal(firstCell(forward), 0);
  assert.ok(firstCell(backward) > 50, backward[1].maskPosition);
});

test("the highlight stretches over both tabs before letting go of the old one", () => {
  const from = { start: 10, size: 40 };
  const to = { start: 120, size: 60 };
  const stretch = indicatorFrames("stretch", from, to);
  assert.deepEqual(stretch.frames[1], { start: 10, size: 170 });
  const back = indicatorFrames("stretch", to, from);
  assert.deepEqual(back.frames[1], { start: 10, size: 170 });
  assert.equal(indicatorFrames("slide", from, to).frames.length, 2);
  assert.equal(indicatorFrames("jump", from, to), null);
  assert.equal(indicatorFrames("stretch", from, from), null);
});

test("speed scales every duration", () => {
  const slow = pageSwitchSpeed("slow");
  const fast = pageSwitchSpeed("fast");
  for (const effect of ["fade", "ripple", "wipe", "sheen", "pixel"]) {
    const normal = pageLayers(request(effect))[0].duration;
    assert.ok(pageLayers(request(effect, { speed: slow }))[0].duration > normal);
    assert.ok(pageLayers(request(effect, { speed: fast }))[0].duration < normal);
  }
  assert.ok(indicatorDuration("slide", fast) < indicatorDuration("slide", 1));
});
