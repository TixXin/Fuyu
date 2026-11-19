import assert from "node:assert/strict";
import test from "node:test";
import { createCollapsedFit, fitFloor, holdFitWidth } from "../../src/windows/island/collapsedFitStore.ts";
import { collapsedWidth } from "../../src/windows/island/collapsedWidth.ts";
import { MAX_COLLAPSED_ISLAND_WIDTH, MAX_FITTED_COLLAPSED_WIDTH, maxCollapsedIslandWidth } from "../../src/windows/island/layout.ts";

test("a reading that changes every second settles on one width instead of following each value", () => {
  let held;
  const seen = new Set();
  for (const measured of [118, 121, 116, 124, 119, 122, 117, 125, 120, 104, 126, 105, 120]) {
    held = holdFitWidth(held, measured);
    seen.add(held);
  }
  assert.deepEqual([...seen], [120, 128]);
});

test("an item grows at once and only shrinks once it is clearly narrower", () => {
  assert.equal(holdFitWidth(120, 150), 152);
  assert.equal(holdFitWidth(152, 140), 152);
  assert.equal(holdFitWidth(152, 128), 152);
  assert.equal(holdFitWidth(152, 120), 120);
  assert.equal(holdFitWidth(undefined, 0), 0);
});

test("a declared width is the floor, so old plugins keep at least what they asked for", () => {
  assert.equal(holdFitWidth(undefined, 30, 66), 66);
  assert.equal(holdFitWidth(66, 90, 66), 96);
  assert.equal(holdFitWidth(96, 20, 66), 96);
  assert.equal(holdFitWidth(104, 20, 66), 66);
});

test("a plugin's width that is not a finite positive number, or throws, counts as no floor", () => {
  assert.equal(fitFloor(120, {}), 120);
  assert.equal(fitFloor(() => 80, {}), 80);
  for (const bad of ["120", -5, Number.NaN, Infinity, null, undefined, () => { throw new Error("boom"); }]) assert.equal(fitFloor(bad, {}), 0);
});

test("the store sums held widths plus one gap per item, tells listeners only when the sum changes, and forgets removed items", () => {
  const fit = createCollapsedFit();
  let calls = 0;
  fit.subscribe(() => { calls += 1; });
  fit.report("monitor", 121);
  fit.report("clock", 40, 66);
  assert.equal(fit.total(), 128 + 8 + 66 + 8);
  fit.report("monitor", 124);
  assert.equal(calls, 2);
  fit.drop("clock");
  assert.equal(fit.total(), 136);
  fit.drop("clock");
  assert.equal(calls, 3);
});

const base = { lines: [], noticeText: null, appName: "Fuyu", showTitle: false, widthExtra: 0, peeking: false, center: false, centerWidth: 0, sideWidth: 0, viewportWidth: 820, devicePixelRatio: 1 };

test("without plugin items the collapsed width is what it was before measuring existed", () => {
  assert.equal(collapsedWidth(base), collapsedWidth({ ...base, fitWidth: 0, collapsedScale: 1 }));
  assert.equal(collapsedWidth({ ...base, sideWidth: 200 }), MAX_COLLAPSED_ISLAND_WIDTH);
});

test("plugin items widen the island past the old 340px cap, up to the shared cap", () => {
  const plain = collapsedWidth(base);
  const widened = collapsedWidth({ ...base, fitWidth: 136 });
  assert.ok(widened > MAX_COLLAPSED_ISLAND_WIDTH && Math.abs(widened - (plain + 136)) <= 4, `${plain} + 136 ≈ ${widened}`);
  assert.equal(collapsedWidth({ ...base, sideWidth: 200, fitWidth: 600 }), MAX_FITTED_COLLAPSED_WIDTH);
  assert.ok(collapsedWidth({ ...base, noticeText: "x".repeat(200), widthExtra: 180 }) <= MAX_FITTED_COLLAPSED_WIDTH);
});

test("the shared cap matches the native clamp and never exceeds what the stage window can show", () => {
  assert.equal(MAX_FITTED_COLLAPSED_WIDTH, 520);
  for (const scale of [0.75, 1, 1.4, 2, 3]) {
    const cap = maxCollapsedIslandWidth(scale);
    assert.ok(cap <= MAX_FITTED_COLLAPSED_WIDTH && cap * scale <= 820, `scale ${scale}: ${cap}`);
  }
});
