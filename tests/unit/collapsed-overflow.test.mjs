import assert from "node:assert/strict";
import test from "node:test";
import { balancedLanes, fitCollapsedZones, fitPill, HYDRATE_GRACE_MS, isUnbalanced, leastWing, overflowCount, resolveUnitWidth } from "../../src/windows/island/collapsedOverflow.ts";

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

test("with a least of two, a wing short of two items takes the items next to the notch from the other wing, keeping the reading order", () => {
  const lanes = balancedLanes([31], [20, 66, 34], 2);
  assert.deepEqual(lanes.left.map((entry) => [entry.from, entry.index]), [["left", 0], ["right", 0]]);
  assert.deepEqual(lanes.right.map((entry) => [entry.from, entry.index]), [["right", 1], ["right", 2]]);
  const back = balancedLanes([10, 20, 30, 40], [], 2);
  assert.deepEqual(back.left.map((entry) => entry.index), [0, 1]);
  assert.deepEqual(back.right.map((entry) => [entry.from, entry.index]), [["left", 2], ["left", 3]]);
});

test("balancing skips items that draw nothing and leaves wings alone when neither is short", () => {
  const lanes = balancedLanes([9], [0, 50, 0, 40, 30], 2);
  assert.deepEqual(lanes.left.map((entry) => entry.index), [0, 1]);
  assert.equal(lanes.left[1].from, "right");
  assert.deepEqual(balancedLanes([9], [50, 40], 2).left.length, 1);
  assert.deepEqual(balancedLanes([9, 9], [50, 40, 30], 2).left.length, 2);
  assert.equal(isUnbalanced(1, 3), true);
  assert.equal(isUnbalanced(1, 2), false);
  assert.equal(isUnbalanced(3, 0), true);
});

test("user-placed items are balanced too: one left and three right become two and two, nothing behind the chip", () => {
  const result = fitCollapsedZones({ widths: [31], capacity: 110 }, { widths: [20, 66, 34], capacity: 110, movable: [false, false, false] }, GAP, CHIP, { least: 2 });
  assert.deepEqual(result.right, [false, false, false]);
  assert.deepEqual(result.moved.right, [true, false, false]);
  assert.equal(result.chip, null);
  assert.deepEqual(result.used, { left: 31 + GAP + 20, right: 66 + GAP + 34 });
});

test("the least wing fits the first two items of each balanced wing, plus the chip when more are waiting", () => {
  const reserved = { left: 20, right: 28 };
  assert.equal(leastWing(balancedLanes([31], [20, 66, 34], 2), reserved, GAP, CHIP), 28 + 66 + GAP + 34);
  const crowded = balancedLanes([31, 20, 40], [66, 34], 2);
  assert.equal(leastWing(crowded, reserved, GAP, CHIP), Math.max(20 + 31 + GAP + 20, 28 + 66 + GAP + 34, 20 + 31 + GAP + 20 + CHIP + GAP));
});

test("a forced chip (notch text waiting behind +N) gets room of its own, so the status light is not shelved with it", () => {
  const reserved = { left: 20, right: 20 };
  const lanes = balancedLanes([46], [33, 20], 2);
  const wing = leastWing(lanes, reserved, GAP, CHIP, 2, true);
  assert.equal(wing, Math.max(20 + 46 + GAP + CHIP, 20 + 33 + GAP + 20));
  const fit = fitCollapsedZones({ widths: [46], capacity: wing - reserved.left }, { widths: [33, 20], capacity: wing - reserved.right }, GAP, CHIP, { least: 2, forceChip: true });
  assert.deepEqual(fit.left, [false], "the jellyfish stays beside +N");
  assert.deepEqual(fit.right, [false, false]);
  assert.equal(fit.chip, "left");
});

test("without a notch everything stays on the bar while it fits, with no chip", () => {
  assert.deepEqual(fitPill([24, 40, 30], 200, GAP, CHIP), { away: [false, false, false], chip: false, used: 24 + 40 + 30 + 3 * GAP });
});

test("without a notch the items later in the list go first, and the chip takes room of its own", () => {
  const result = fitPill([24, 40, 30, 50], 140, GAP, CHIP);
  assert.deepEqual(result.away, [false, false, true, true]);
  assert.equal(result.chip, true);
  assert.ok(result.used <= 140);
});

test("without a notch a wide item behind the chip does not hold back a narrow one after it", () => {
  assert.deepEqual(fitPill([24, 120, 20], 100, GAP, CHIP).away, [false, true, false]);
});

test("without a notch an item that draws nothing is never put away", () => {
  assert.deepEqual(fitPill([0, 60, 0, 60], 120, GAP, CHIP).away, [false, false, false, true]);
});

test("without a notch a kept chip reserves its room, and switching put-away off keeps every item", () => {
  assert.deepEqual(fitPill([40, 40], 96, GAP, CHIP, { forceChip: true }).away, [false, true]);
  assert.deepEqual(fitPill([40, 40, 40], 60, GAP, CHIP, { auto: false }).away, [false, false, false]);
});

test("a freshly remounted async item keeps its previous width during hydration instead of bouncing back to 0", () => {
  const held = resolveUnitWidth(0, 48, false, 1000, 1020);
  assert.equal(held.width, 48);
  assert.equal(held.hydrating, true);
  assert.equal(held.retryIn, HYDRATE_GRACE_MS - 20);

  const hydrated = resolveUnitWidth(52, 48, false, 1000, 1030);
  assert.deepEqual(hydrated, { width: 52, hydrating: false, retryIn: null });

  const emptiedInPlace = resolveUnitWidth(0, 52, true, 1000, 1040);
  assert.deepEqual(emptiedInPlace, { width: 0, hydrating: false, retryIn: null });

  const timedOut = resolveUnitWidth(0, 48, false, 1000, 1000 + HYDRATE_GRACE_MS);
  assert.deepEqual(timedOut, { width: 0, hydrating: false, retryIn: null });

  const neverShown = resolveUnitWidth(0, 0, false, 1000, 1010);
  assert.deepEqual(neverShown, { width: 0, hydrating: false, retryIn: null });
});
