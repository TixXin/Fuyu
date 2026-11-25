import assert from "node:assert/strict";
import test from "node:test";
import { cardPlacement } from "../../src/windows/onboarding/placement.ts";
import { islandDemoUntil, parseWelcome } from "../../src/windows/onboarding/storage.ts";

const screen = { width: 1920, height: 1040 };
const island = { x: 830, y: 0, width: 260, height: 38, expanded: false };

const overlaps = (placement, spot) =>
  placement.left < spot.x + spot.width &&
  placement.left + placement.width > spot.x &&
  placement.top < spot.y + spot.height;

test("the stage card sits comfortably below the closed island, centred on it", () => {
  const placement = cardPlacement(island, screen);
  assert.equal(placement.width, 760);
  assert.equal(placement.top, 108);
  assert.equal(placement.left + placement.width / 2, 960);
  assert.equal(placement.centered, false);
});

test("the card stays on screen when the island is near an edge", () => {
  assert.equal(cardPlacement({ ...island, x: 0 }, screen, "compact").left, 16);
  const right = cardPlacement({ ...island, x: 1900 }, screen, "compact");
  assert.equal(right.left + right.width, 1904);
  assert.equal(cardPlacement(island, { width: 400, height: 900 }, "stage").width, 368);
});

test("the open island never covers the card and always transitions via top", () => {
  const shortOpen = { x: 680, y: 0, width: 560, height: 300, expanded: true };
  const tallOpen = { x: 680, y: 0, width: 560, height: 740, expanded: true };
  assert.equal(cardPlacement(shortOpen, screen, "compact").top, 324);
  assert.equal(cardPlacement(tallOpen, screen, "compact").left, 1264);
  for (const spot of [shortOpen, tallOpen]) {
    const place = cardPlacement(spot, screen, "compact");
    assert.ok(typeof place.top === "number");
    assert.ok(!overlaps(place, spot));
  }
  const leftSide = cardPlacement({ ...tallOpen, x: 1300 }, screen, "compact");
  assert.equal(leftSide.left + leftSide.width, 1276);
});

test("bottom and side-docked islands keep the card safely out of the way", () => {
  const bottomIsland = { x: 800, y: 980, width: 320, height: 40, expanded: false };
  const aboveBottom = cardPlacement(bottomIsland, screen, "stage");
  assert.ok(aboveBottom.top + aboveBottom.maxHeight < bottomIsland.y);

  const leftSideIsland = { x: 0, y: 400, width: 44, height: 180, expanded: false };
  const besideLeft = cardPlacement(leftSideIsland, screen, "stage");
  assert.ok(besideLeft.left >= leftSideIsland.width + 24);
});

test("workspace and wide layout centre a wider card safely below the top island", () => {
  const wide = cardPlacement(island, screen, "wide", true);
  assert.equal(wide.width, 660);
  assert.equal(wide.centered, true);
  assert.equal(wide.left + wide.width / 2, 960);
  assert.ok(wide.top >= island.height + 24);
});

test("without an island the card centres safely on screen", () => {
  const placement = cardPlacement(null, screen);
  assert.equal(placement.centered, true);
  assert.equal(placement.left + placement.width / 2, 960);
  assert.ok(placement.top > 0);
});

test("safe insets keep the card clear of macOS menu bar and bottom or side Dock", () => {
  const macScreen = { width: 1512, height: 982 };
  const macIsland = { x: 626, y: 0, width: 260, height: 38, expanded: false };
  const withBottomDock = cardPlacement(macIsland, macScreen, "stage", false, { top: 37, bottom: 88, left: 0, right: 0 });
  assert.ok(withBottomDock.top + withBottomDock.maxHeight <= macScreen.height - 88 - 16);

  const withLeftDock = cardPlacement(null, macScreen, "stage", true, { top: 37, bottom: 0, left: 80, right: 0 });
  assert.ok(withLeftDock.left >= 80 + 16);
  assert.ok(withLeftDock.top >= 37 + 16);
});

test("welcome requests: fresh ones carry their kind, old or broken ones are ignored", () => {
  const now = 1_000_000;
  assert.equal(parseWelcome(JSON.stringify({ kind: "hello", requestedAt: now - 100 }), now), "hello");
  assert.equal(parseWelcome(JSON.stringify({ requestedAt: now }), now), "ready");
  assert.equal(parseWelcome(JSON.stringify({ kind: "hello", requestedAt: now - 10_000 }), now), null);
  assert.equal(parseWelcome("{", now), null);
  assert.equal(parseWelcome(null, now), null);
});

test("the demo's end time is read leniently", () => {
  assert.equal(islandDemoUntil(JSON.stringify({ until: 42 })), 42);
  assert.equal(islandDemoUntil("{}"), 0);
  assert.equal(islandDemoUntil("nope"), 0);
  assert.equal(islandDemoUntil(null), 0);
});
