import assert from "node:assert/strict";
import test from "node:test";
import { MIRROR_HTML_LIMIT, readMirrorFrame } from "../../src/features/plugin-kernel/barMirror.ts";

const box = (left, width = 20) => ({ left, top: 4, width, height: 20 });
const frame = (extra = {}) => ({ shown: true, form: "notch", width: 400, height: 32, html: "<section></section>", items: [], more: null, middle: box(100, 200), center: null, ...extra });

test("a mirror frame keeps only well-formed items and boxes", () => {
  const read = readMirrorFrame(frame({ items: [{ id: "mail", box: box(310) }, { id: "", box: box(1) }, { id: "music", box: { left: 1 } }, { id: "timer", box: box(5, 0) }, null], more: box(340, 28), center: "x" }));
  assert.deepEqual(read.items, [{ id: "mail", box: box(310) }]);
  assert.deepEqual(read.more, box(340, 28));
  assert.equal(read.center, null);
  assert.equal(read.form, "notch");
  assert.equal(read.shown, true);
});

test("a frame that is not shown, has no markup or names an unknown form is read as such", () => {
  assert.equal(readMirrorFrame(frame({ shown: false })).shown, false);
  assert.equal(readMirrorFrame(frame({ html: "" })).shown, false);
  assert.equal(readMirrorFrame(frame({ form: "cube" })).form, "bar");
  assert.equal(readMirrorFrame(frame({ shown: false, miss: "big" })).miss, "big");
  assert.equal(readMirrorFrame(frame({ miss: "lost" })).miss, null);
});

test("frames that are malformed or too large are dropped", () => {
  assert.equal(readMirrorFrame(null), null);
  assert.equal(readMirrorFrame(frame({ html: 5 })), null);
  assert.equal(readMirrorFrame(frame({ width: -1 })), null);
  assert.equal(readMirrorFrame(frame({ items: "none" })), null);
  assert.equal(readMirrorFrame(frame({ html: "x".repeat(MIRROR_HTML_LIMIT + 1) })), null);
});

test("copied styles leave out CSS variables, logical duplicates and motion, which WebKit lists and would bloat every element", async () => {
  const { styleValues } = await import("../../src/features/plugin-kernel/barMirrorStyle.ts");
  const names = ["--island-scale", "color", "block-size", "height", "margin-inline-start", "margin-left", "-webkit-margin-start", "transition-duration", "min-width", "border-start-start-radius", "border-top-left-radius"];
  const style = Object.assign(Object.fromEntries(names.map((name, index) => [index, name])), { length: names.length, getPropertyValue: (name) => `v:${name}` });
  assert.deepEqual([...styleValues(style).keys()], ["color", "height", "margin-left", "min-width", "border-top-left-radius"]);
});
