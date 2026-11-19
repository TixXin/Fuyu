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

test("items are kept in list order: the first ones stay, the rest go behind the chip", () => {
  const result = fit(zone([9]), zone([50, 50, 12]));
  assert.deepEqual(result.right, [false, true, true]);
  assert.deepEqual(result.left, [false]);
});

test("an item further down the list is not pulled forward past one that did not fit", () => {
  const result = fit(zone([]), zone([40, 60, 10]));
  assert.deepEqual(result.right, [false, true, true]);
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
  assert.deepEqual(result.left, [true, true]);
  assert.deepEqual(result.right, [false, false, true]);
  assert.ok(result.used.left <= 80 && result.used.right <= 80);
});

test("what is drawn never exceeds a wing's room, the chip included", () => {
  for (const widths of [[30, 30, 30, 30], [80], [81], [10, 10, 10, 10, 10, 10, 10], [79, 1]]) {
    const result = fit(zone(widths, 60), zone(widths, 80));
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
