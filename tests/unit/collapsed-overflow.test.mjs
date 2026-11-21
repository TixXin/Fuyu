import assert from "node:assert/strict";
import test from "node:test";
import { fitCollapsedZones, overflowCount } from "../../src/windows/island/collapsedOverflow.ts";

const GAP = 8;
const CHIP = 26;
const zone = (widths, capacity = 80) => ({ widths, capacity });
const fit = (left, right) => fitCollapsedZones(left, right, GAP, CHIP);

test("nothing is put away and no chip is drawn while both wings fit", () => {
  const result = fit(zone([54]), zone([24, 20]));
  assert.deepEqual(result.left, [false]);
  assert.deepEqual(result.right, [false, false]);
  assert.equal(result.chip, null);
  assert.deepEqual(result.used, { left: 54, right: 52 });
});

test("an item that does not fit is skipped and the narrower ones after it still get its place", () => {
  const result = fit(zone([9]), zone([50, 50, 12]));
  assert.deepEqual(result.right, [false, true, false]);
  assert.deepEqual(result.left, [false]);
  assert.equal(result.used.right, 50 + GAP + 12);
});

test("a wide item does not take the narrow ones after it behind the chip", () => {
  const result = fit(zone([]), zone([40, 60, 10]));
  assert.deepEqual(result.right, [false, true, false]);
});

test("an item that does not fit its own wing moves into the other wing's free room before going behind the chip", () => {
  const result = fitCollapsedZones(zone([20]), { widths: [28, 48, 40], capacity: 80, movable: [true, true, true] }, GAP, CHIP);
  assert.deepEqual(result.right, [false, false, false]);
  assert.deepEqual(result.moved.right, [false, true, false]);
  assert.equal(result.chip, null);
  assert.deepEqual(result.used, { left: 20 + GAP + 48, right: 28 + GAP + 40 });
});

test("an item the user placed stays in its wing and goes behind the chip instead of moving", () => {
  const result = fitCollapsedZones(zone([28]), { widths: [28, 60], capacity: 80, movable: [false, false] }, GAP, CHIP);
  assert.deepEqual(result.right, [false, true]);
  assert.deepEqual(result.moved.right, [false, false]);
  assert.equal(result.chip, "left");
});

test("an item that draws nothing is never counted or put away", () => {
  const result = fit(zone([9]), zone([0, 50, 0, 50, 0]));
  assert.deepEqual(result.right, [false, false, false, true, false]);
  assert.equal(overflowCount(result, { left: [1], right: [1, 1, 1, 1, 1] }), 1);
});

test("the chip goes to the wing with more room left, and to the left on a tie", () => {
  assert.equal(fit(zone([9]), zone([50, 50])).chip, "left");
  assert.equal(fit(zone([70, 70]), zone([20])).chip, "right");
  assert.equal(fit(zone([40, 70]), zone([40, 70])).chip, "left");
});

test("when neither wing has room for the chip, the roomier wing gives up one more item for it", () => {
  const result = fit(zone([70, 30]), zone([40, 30, 30]));
  assert.equal(result.chip, "left");
  assert.deepEqual(result.left, [true, false]);
  assert.deepEqual(result.right, [false, false, true]);
  assert.ok(result.used.left <= 80 && result.used.right <= 80);
});

test("what is drawn never exceeds a wing's room, the chip and borrowed items included", () => {
  for (const widths of [[30, 30, 30, 30], [80], [81], [10, 10, 10, 10, 10, 10, 10], [79, 1], [50, 20, 45, 9]]) {
    const movable = widths.map(() => true);
    const result = fitCollapsedZones({ widths, capacity: 60, movable }, { widths, capacity: 80, movable }, GAP, CHIP);
    assert.ok(result.used.left <= 60, `left ${widths}`);
    assert.ok(result.used.right <= 80, `right ${widths}`);
  }
});

test("a grouped unit counts as many as it holds", () => {
  const result = fit(zone([9]), zone([60, 44]));
  assert.equal(overflowCount(result, { left: [1], right: [1, 2] }), 2);
});

test("with an item the user keeps in the panel, the chip is drawn even when everything fits", () => {
  const result = fitCollapsedZones(zone([9]), zone([24, 20]), GAP, CHIP, { forceChip: true });
  assert.deepEqual(result.left, [false]);
  assert.deepEqual(result.right, [false, false]);
  assert.equal(result.chip, "left");
  assert.equal(result.used.left, 9 + GAP + CHIP);
});

test("a forced chip still makes room for itself by putting one more item away", () => {
  const result = fitCollapsedZones(zone([70]), zone([70]), GAP, CHIP, { forceChip: true });
  assert.equal(result.chip, "left");
  assert.deepEqual(result.left, [true]);
  assert.deepEqual(result.right, [false]);
});

test("with putting away switched off nothing is put away, and the chip appears only when forced", () => {
  const off = fitCollapsedZones(zone([9]), zone([50, 50, 50]), GAP, CHIP, { auto: false });
  assert.deepEqual(off.right, [false, false, false]);
  assert.equal(off.chip, null);
  const forced = fitCollapsedZones(zone([9]), zone([50, 50, 50]), GAP, CHIP, { auto: false, forceChip: true });
  assert.deepEqual(forced.right, [false, false, false]);
  assert.equal(forced.chip, "left");
});
