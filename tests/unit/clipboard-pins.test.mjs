import assert from "node:assert/strict";
import test from "node:test";
import { digitSlot, itemForPinKey, movedPinOrder, pinKeyFromCode, pinnedLayout, PIN_KEYS } from "../../src/features/clipboard/pins.ts";

const item = (id, copiedAt, extra = {}) => ({ id, kind: "text", hash: id, createdAt: copiedAt, copiedAt, preview: id, text: id, ...extra });

test("favorites go first in their saved order, old ones without an order after them by copy time", () => {
  const items = [item("a", 9), item("b", 8, { favorite: true }), item("c", 7, { favorite: true, pinOrder: 1 }), item("d", 6, { favorite: true, pinOrder: 0 }), item("e", 5, { favorite: true })];
  const layout = pinnedLayout(items, true);
  assert.deepEqual(layout.items.map((entry) => entry.id), ["d", "c", "b", "e", "a"]);
  assert.equal(layout.pinned, 4);
  assert.deepEqual(pinnedLayout(items, false), { items, pinned: 0 });
});

test("digits skip the pinned rows", () => {
  assert.equal(digitSlot(0, 2), null);
  assert.equal(digitSlot(2, 2), 0);
  assert.equal(digitSlot(10, 2), 8);
  assert.equal(digitSlot(11, 2), null);
  assert.equal(digitSlot(0, 0), 0);
});

test("pin keys come from the physical key so ⌥ characters on the Mac still match", () => {
  assert.equal(pinKeyFromCode("KeyK"), "K");
  assert.equal(pinKeyFromCode("KeyE"), null);
  assert.equal(pinKeyFromCode("Digit1"), null);
  assert.equal(pinKeyFromCode(undefined), null);
  assert.ok(!["E", "I", "N", "U"].some((key) => PIN_KEYS.includes(key)));
  const items = [item("a", 1, { pinKey: "K" }), item("b", 2, { favorite: true, pinKey: "K" })];
  assert.equal(itemForPinKey(items, "K")?.id, "b");
  assert.equal(itemForPinKey(items, null), undefined);
});

test("moving a pinned row gives the whole new order", () => {
  const pinned = [item("a", 1), item("b", 2), item("c", 3)];
  assert.deepEqual(movedPinOrder(pinned, 0, 2), ["b", "c", "a"]);
  assert.equal(movedPinOrder(pinned, 1, 1), null);
  assert.equal(movedPinOrder(pinned, 2, 3), null);
});
