import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PAGES, runnerOptions } from "../../scripts/run-regression.mjs";
import { pageKey, parseShard, readTimings, slowestFirst, splitPages } from "../../scripts/regression/shards.mjs";
import { pageSeconds } from "../../scripts/regression/timings.mjs";

test("every page lands in exactly one shard, in the order the list gives", () => {
  const timings = readTimings(fileURLToPath(new URL("../..", import.meta.url)));
  for (const count of [1, 2, 3, 5]) {
    const shards = splitPages(PAGES, count, timings);
    assert.equal(shards.length, count);
    assert.deepEqual(shards.flat().sort(), [...PAGES].sort());
    for (const shard of shards) assert.deepEqual(shard, PAGES.filter((page) => shard.includes(page)));
  }
});

test("shards are split by time, so one slow page does not drag its shard past the others", () => {
  const pages = ["slow.html", "a.html", "b.html", "c.html", "d.html", "e.html"];
  const timings = { "slow.html": 50, "a.html": 10, "b.html": 10, "c.html": 10, "d.html": 10, "e.html": 10 };
  assert.deepEqual(splitPages(pages, 2, timings), [["slow.html"], ["a.html", "b.html", "c.html", "d.html", "e.html"]]);
});

test("a page with no recorded time counts as a median one, and the query string is ignored", () => {
  const pages = ["known.html?test=1", "new.html", "quick.html", "mid.html"];
  const timings = { "known.html": 30, "quick.html": 2, "mid.html": 4 };
  assert.deepEqual(slowestFirst(pages, timings), ["known.html?test=1", "new.html", "mid.html", "quick.html"]);
  assert.deepEqual(splitPages(pages, 2, timings), [["known.html?test=1"], ["new.html", "quick.html", "mid.html"]]);
});

test("--shard takes index/count within range, --jobs a whole number", () => {
  assert.deepEqual(parseShard("2/3"), { index: 2, count: 3 });
  for (const bad of ["0/3", "4/3", "1/0", "3", "a/b", undefined]) assert.equal(parseShard(bad), null);
  assert.deepEqual(runnerOptions(["todo", "--shard", "1/2", "--jobs", "3", "--update-snapshots"]), { words: ["todo"], shard: { index: 1, count: 2 }, jobs: 3, update: true });
  assert.match(runnerOptions(["--shard", "5/2"]).error, /--shard/);
  assert.match(runnerOptions(["--jobs", "0"]).error, /--jobs/);
});

test("page times are read from CI log lines, with or without the timestamp, and averaged across runs", () => {
  const first = "2026-11-22T14:10:51.29Z ✓ builtins-off.html  passed, 12 checks, 90.0s\r\n✗ settings.html?test=1  failed, 3 checks, 4.1s\n    snapshot changed: x";
  const second = "2026-11-22T14:20:51.29Z ✓ builtins-off.html  passed, 12 checks, 100.0s\n✗ settings.html?test=1  timed out, 0 checks, 120.0s";
  assert.deepEqual(pageSeconds([first, second]), { "builtins-off.html": 95, "settings.html": 62.1 });
});

test("the parts of a split page keep their own time, other queries are dropped", () => {
  assert.equal(pageKey("settings.html?test=1"), "settings.html");
  assert.equal(pageKey("builtins-off.html?only=timer"), "builtins-off.html?only=timer");
  assert.equal(pageKey("builtins-off.html?self"), "builtins-off.html?self");
  const log = "✓ builtins-off.html?self  passed, 5 checks, 9.0s\n✓ builtins-off.html?only=timer  passed, 1 checks, 4.0s";
  assert.deepEqual(pageSeconds([log]), { "builtins-off.html?only=timer": 4, "builtins-off.html?self": 9 });
  const parts = PAGES.filter((page) => page.startsWith("builtins-off.html"));
  assert.ok(parts.length > 2);
  assert.equal(new Set(parts.map(pageKey)).size, parts.length);
});
