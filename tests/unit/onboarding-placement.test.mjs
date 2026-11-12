import assert from "node:assert/strict";
import test from "node:test";
import { cardPlacement, nextAnchor } from "../../src/windows/onboarding/placement.ts";
import { islandDemoUntil, parseWelcome } from "../../src/windows/onboarding/storage.ts";

const screen = { width: 1920, height: 1040 };
const island = { x: 830, y: 0, width: 260, height: 38, expanded: false };

test("the card sits below the island, centred on it", () => {
  const placement = cardPlacement(island, screen, false);
  assert.equal(placement.top, 66);
  assert.equal(placement.left + placement.width / 2, 960);
  assert.equal(placement.bottom, undefined);
});

test("the card stays on screen when the island is near an edge", () => {
  const left = cardPlacement({ ...island, x: 0 }, screen, false);
  const right = cardPlacement({ ...island, x: 1900 }, screen, false);
  assert.equal(left.left, 16);
  assert.equal(right.left + right.width, 1904);
  const narrow = cardPlacement(island, { width: 400, height: 600 }, false);
  assert.equal(narrow.width, 368);
});

test("the practice act and a hidden island dock the card at the bottom", () => {
  for (const placement of [cardPlacement(island, screen, true), cardPlacement(null, screen, false)]) {
    assert.equal(placement.top, undefined);
    assert.equal(placement.bottom, 40);
  }
});

test("the anchor is the island as last seen closed", () => {
  const open = { ...island, height: 380, expanded: true };
  assert.equal(nextAnchor(null, island), island);
  assert.equal(nextAnchor(island, open), island);
  assert.equal(nextAnchor(null, open), open);
  assert.equal(nextAnchor(island, null), island);
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
