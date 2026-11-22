import assert from "node:assert/strict";
import test from "node:test";
import { arrangeCollapsedItems } from "../../src/lib/settings/collapsedItems.ts";
import { emptierZone, placeFreshItems } from "../../src/windows/island/pluginPlacement.ts";
import { itemPlace } from "../../src/windows/settings/island-layout/itemPlace.ts";

const offered = ["status-light", "music", "session-count", "plugin:weather"];

test("a new plugin item goes left when the left side has fewer items", () => {
  const placements = arrangeCollapsedItems(offered, []);
  assert.equal(emptierZone(placements, offered, ["plugin:weather"]), "left");
  assert.deepEqual(placeFreshItems([], placements, offered, ["plugin:weather"]), [{ id: "plugin:weather", zone: "left" }]);
  const after = arrangeCollapsedItems(offered, [{ id: "plugin:weather", zone: "left" }]);
  assert.deepEqual(after.filter((placement) => placement.zone === "left").map(({ id }) => id), ["status-light", "plugin:weather"]);
});

test("a new plugin item keeps the default right side when the sides are even or the right is emptier", () => {
  const more = [...offered, "plugin:clock"];
  const saved = [{ id: "plugin:weather", zone: "left" }];
  const placements = arrangeCollapsedItems(more, saved);
  assert.equal(emptierZone(placements, more, ["plugin:clock"]), "right");
  assert.equal(placeFreshItems(saved, placements, more, ["plugin:clock"]), null);
  const leftHeavy = arrangeCollapsedItems(offered, [{ id: "music", zone: "left" }, { id: "session-count", zone: "left" }]);
  assert.equal(emptierZone(leftHeavy, offered, ["plugin:weather"]), "right");
});

test("hidden, shelved and absent items do not count toward a side", () => {
  const saved = [{ id: "music", zone: "right", hidden: true }, { id: "session-count", zone: "right", shelf: true }, { id: "device-use", zone: "right" }];
  const placements = arrangeCollapsedItems(offered, saved);
  assert.equal(emptierZone(placements, offered, ["plugin:weather"]), "right");
});

test("items the user already placed are never moved", () => {
  const saved = [{ id: "plugin:weather", zone: "right" }];
  const placements = arrangeCollapsedItems(offered, saved);
  assert.equal(placeFreshItems(saved, placements, offered, ["plugin:weather"]), null);
  assert.equal(placeFreshItems([], arrangeCollapsedItems(offered, []), offered, ["plugin:missing"]), null);
});

test("every new item of the plugin moves together and the rest of the layout is untouched", () => {
  const more = [...offered, "plugin:weather.rain"];
  const saved = [{ id: "music", zone: "right" }];
  const placed = placeFreshItems(saved, arrangeCollapsedItems(more, saved), more, ["plugin:weather", "plugin:weather.rain"]);
  assert.deepEqual(placed, [{ id: "music", zone: "right" }, { id: "plugin:weather", zone: "left" }, { id: "plugin:weather.rain", zone: "left" }]);
});

test("an item the bar put behind +N reads as being in the panel", () => {
  const placements = arrangeCollapsedItems(offered, []);
  const listed = new Set(offered);
  const away = new Set(["plugin:weather"]);
  assert.deepEqual(itemPlace(placements, listed, "plugin:weather"), { kind: "right", position: 1 });
  assert.deepEqual(itemPlace(placements, listed, "music"), { kind: "right", position: 2 });
  assert.deepEqual(itemPlace(placements, listed, "plugin:weather", away), { kind: "panel" });
  assert.deepEqual(itemPlace(placements, listed, "music", away), { kind: "right", position: 1 });
});
