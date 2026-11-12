import assert from "node:assert/strict";
import test from "node:test";
import { cardPlacement } from "../../src/windows/onboarding/placement.ts";
import { islandDemoUntil, parseWelcome } from "../../src/windows/onboarding/storage.ts";

const screen = { width: 1920, height: 1040 };
const island = { x: 830, y: 0, width: 260, height: 38, expanded: false };

const overlaps = (placement, spot, viewport) => {
  const top = placement.top ?? viewport.height - placement.bottom - placement.maxHeight;
  return placement.left < spot.x + spot.width && placement.left + placement.width > spot.x && top < spot.y + spot.height;
};

test("the card sits below the closed island, centred on it", () => {
  const placement = cardPlacement(island, screen);
  assert.equal(placement.top, 66);
  assert.equal(placement.left + placement.width / 2, 960);
});

test("the card stays on screen when the island is near an edge", () => {
  assert.equal(cardPlacement({ ...island, x: 0 }, screen).left, 16);
  const right = cardPlacement({ ...island, x: 1900 }, screen);
  assert.equal(right.left + right.width, 1904);
  assert.equal(cardPlacement(island, { width: 400, height: 900 }).width, 368);
});

test("the open island never covers the card", () => {
  const shortOpen = { x: 680, y: 0, width: 560, height: 300, expanded: true };
  const tallOpen = { x: 680, y: 0, width: 560, height: 640, expanded: true };
  assert.equal(cardPlacement(shortOpen, screen).top, 328);
  assert.equal(cardPlacement(tallOpen, screen).left, 1268);
  for (const spot of [shortOpen, tallOpen]) assert.ok(!overlaps(cardPlacement(spot, screen), spot, screen));
  const leftSide = cardPlacement({ ...tallOpen, x: 1300 }, screen);
  assert.equal(leftSide.left + leftSide.width, 1272);
});

test("without an island the card docks at the bottom", () => {
  const placement = cardPlacement(null, screen);
  assert.equal(placement.top, undefined);
  assert.equal(placement.bottom, 40);
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
