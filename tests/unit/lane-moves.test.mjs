import assert from "node:assert/strict";
import test from "node:test";
import { firstSpilled, laneIds, placeItem, restoreItem, sameLayout, stepItem } from "../../src/windows/settings/island-layout/laneMoves.ts";

const listed = new Set(["status-light", "mail", "music", "timer", "session-count"]);
const base = [
  { id: "status-light", zone: "left" },
  { id: "mail", zone: "right" },
  { id: "music", zone: "right" },
  { id: "timer", zone: "right", shelf: true },
  { id: "session-count", zone: "right", hidden: true },
  { id: "gone", zone: "right" },
];
const lanes = (placements) => Object.fromEntries(["left", "right", "shelf", "off"].map((lane) => [lane, laneIds(placements, lane, listed)]));

test("each item sits in one lane: hidden wins over the shelf, the shelf over its side, and unlisted items are skipped", () => {
  assert.deepEqual(lanes(base), { left: ["status-light"], right: ["mail", "music"], shelf: ["timer"], off: ["session-count"] });
});

test("dropping before a chip puts the item right there, in that lane", () => {
  const next = placeItem(base, "music", "left", "status-light", listed);
  assert.deepEqual(lanes(next).left, ["music", "status-light"]);
  assert.deepEqual(next.find(({ id }) => id === "music"), { id: "music", zone: "left" });
});

test("dropping on a lane with no chip under the pointer adds the item at its end", () => {
  assert.deepEqual(lanes(placeItem(base, "status-light", "right", null, listed)).right, ["mail", "music", "status-light"]);
  assert.deepEqual(lanes(placeItem(base, "mail", "left", null, listed)).left, ["status-light", "mail"]);
});

test("into the shelf an item keeps its side, so taking it out puts it back where it was", () => {
  const shelved = placeItem(base, "status-light", "shelf", null, listed);
  assert.deepEqual(shelved.find(({ id }) => id === "status-light"), { id: "status-light", zone: "left", shelf: true });
  assert.deepEqual(stepItem(shelved, "status-light", "ArrowUp", listed).find(({ id }) => id === "status-light"), { id: "status-light", zone: "left" });
});

test("taking an item off keeps its place, and putting it back restores the same lane and order", () => {
  const off = placeItem(base, "mail", "off", null, listed);
  assert.deepEqual(lanes(off).right, ["music"]);
  assert.equal(off.findIndex(({ id }) => id === "mail"), 1);
  assert.ok(sameLayout(restoreItem(off, "mail"), base));
  assert.deepEqual(restoreItem(base, "session-count").find(({ id }) => id === "session-count"), { id: "session-count", zone: "right" });
});

test("arrow keys move within a lane and spill into the next lane at either end", () => {
  assert.deepEqual(lanes(stepItem(base, "mail", "ArrowRight", listed)).right, ["music", "mail"]);
  assert.deepEqual(lanes(stepItem(base, "mail", "ArrowLeft", listed)).left, ["status-light", "mail"]);
  const toRight = stepItem(base, "status-light", "ArrowRight", listed);
  assert.deepEqual(lanes(toRight).right, ["status-light", "mail", "music"]);
  assert.deepEqual(lanes(stepItem(base, "music", "ArrowRight", listed)).shelf, ["music", "timer"]);
  assert.equal(stepItem(base, "timer", "ArrowRight", listed), null);
  assert.equal(stepItem(base, "status-light", "ArrowLeft", listed), null);
});

test("up and down walk between the bar, the shelf and off", () => {
  assert.deepEqual(lanes(stepItem(base, "mail", "ArrowDown", listed)).shelf, ["timer", "mail"]);
  assert.deepEqual(lanes(stepItem(base, "timer", "ArrowDown", listed)).off, ["timer", "session-count"]);
  assert.deepEqual(lanes(stepItem(base, "session-count", "ArrowUp", listed)).right, ["mail", "music", "session-count"]);
  assert.equal(stepItem(base, "mail", "ArrowUp", listed), null);
  assert.equal(stepItem(base, "session-count", "ArrowDown", listed), null);
});

test("the fold line goes before the first item the island had no room for", () => {
  assert.equal(firstSpilled(["status-light", "mail", "music"], new Set(["music", "status-light"])), "status-light");
  assert.equal(firstSpilled(["mail", "music"], new Set()), null);
});
