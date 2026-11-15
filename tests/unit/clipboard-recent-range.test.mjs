import assert from "node:assert/strict";
import test from "node:test";
import { rangeStart, recentItems } from "../../src/features/clipboard/recentRange.ts";

const item = (id, copiedAt, favorite = false) => ({ id, kind: "text", hash: id, createdAt: copiedAt, copiedAt, preview: id, favorite });

test("ranges start 15 minutes, an hour or local midnight before now", () => {
  const now = new Date(2026, 10, 15, 9, 30).getTime();
  assert.equal(rangeStart("15m", now), now - 15 * 60_000);
  assert.equal(rangeStart("1h", now), now - 3_600_000);
  assert.equal(rangeStart("today", now), new Date(2026, 10, 15).getTime());
});

test("recent entries leave favorites alone and count by the last copy", () => {
  const now = new Date(2026, 10, 15, 9, 30).getTime();
  const items = [item("a", now - 60_000), item("b", now - 10 * 60_000, true), item("c", now - 20 * 60_000), item("d", now - 2 * 3_600_000), item("e", new Date(2026, 10, 14, 23).getTime())];
  assert.deepEqual(recentItems(items, "15m", now).map((entry) => entry.id), ["a"]);
  assert.deepEqual(recentItems(items, "1h", now).map((entry) => entry.id), ["a", "c"]);
  assert.deepEqual(recentItems(items, "today", now).map((entry) => entry.id), ["a", "c", "d"]);
});
