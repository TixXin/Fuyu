import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { groupUnits, plan, prune, staleUnits, summary } from "../../scripts/prune-build-cache.mjs";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 12);

test("per crate the newest few stay, and of the rest only the unused ones go", () => {
  const units = [
    { unit: "fuyu_lib-a", crate: "fuyu_lib", mtimeMs: NOW - 10 * DAY },
    { unit: "fuyu_lib-b", crate: "fuyu_lib", mtimeMs: NOW - 9 * DAY },
    { unit: "fuyu_lib-c", crate: "fuyu_lib", mtimeMs: NOW - 1 * DAY },
    { unit: "fuyu_lib-d", crate: "fuyu_lib", mtimeMs: NOW - 2 * DAY },
    { unit: "fuyu-e", crate: "fuyu", mtimeMs: NOW - 30 * DAY },
  ];
  const cutoff = NOW - 3 * DAY;
  assert.deepEqual(staleUnits(units, cutoff, 2), ["fuyu_lib-a", "fuyu_lib-b"]);
  assert.deepEqual(staleUnits(units, cutoff, 3), ["fuyu_lib-a"]);
  assert.deepEqual(staleUnits(units, NOW - 1.5 * DAY, 1), ["fuyu_lib-a", "fuyu_lib-b", "fuyu_lib-d"], "a recent one stays even past keep");
});

test("an artifact's files count as one unit, as recent as its newest file", () => {
  const times = { "fuyu_lib-0a1b.rlib": 1, "fuyu_lib-0a1b.rmeta": 5, "fuyu_lib-0a1b.d": 2, "serde-99.rlib": 9 };
  const { units, entriesOf } = groupUnits(Object.keys(times), /^(fuyu|fuyu_lib)-([0-9a-z]+)(?:\.|$)/, (name) => times[name]);
  assert.deepEqual(units, [{ unit: "fuyu_lib-0a1b", crate: "fuyu_lib", mtimeMs: 5 }]);
  assert.deepEqual(entriesOf.get("fuyu_lib-0a1b").sort(), ["fuyu_lib-0a1b.d", "fuyu_lib-0a1b.rlib", "fuyu_lib-0a1b.rmeta"]);
});

function touch(file, daysAgo, content = "x") {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
  const time = new Date(NOW - daysAgo * DAY);
  utimesSync(file, time, time);
}

function age(dir, daysAgo) {
  const time = new Date(NOW - daysAgo * DAY);
  utimesSync(dir, time, time);
}

test("a target folder loses old caches, old builds of the app and removed lanes, and keeps the rest", () => {
  const target = mkdtempSync(path.join(tmpdir(), "prune-target-"));
  const at = (...parts) => path.join(target, ...parts);
  try {
    for (const [hash, days] of [["aaa", 20], ["bbb", 10], ["ccc", 2], ["ddd", 1], ["eee", 0]]) {
      touch(at("debug", "incremental", `fuyu_lib-${hash}`, "s-1", "dep-graph.bin"), days);
      age(at("debug", "incremental", `fuyu_lib-${hash}`), days);
    }
    for (const [hash, days] of [["0001", 30], ["0002", 2], ["0003", 1], ["0004", 0]]) {
      touch(at("debug", "deps", `fuyu_lib-${hash}.rlib`), days);
      touch(at("debug", "deps", `fuyu_lib-${hash}.d`), days);
    }
    touch(at("debug", "deps", "focusd_island_lib-0009.rlib"), 40);
    touch(at("debug", "deps", "serde-0010.rlib"), 90, "a dependency");
    touch(at("debug", "deps", ".tmpAbC.temp-archive"), 5);
    touch(at("agents", "debug", "deps", "fuyu_lib-0005.rlib"), 1);
    touch(at("lane-7", "debug", "fuyu.exe"), 8);
    touch(at("lane-2", "debug", "fuyu.exe"), 8);
    touch(at("agents-d16", "debug", "deps", "x.rlib"), 6);
    age(at("agents-d16"), 6);

    const options = { now: NOW, laneExists: (n) => n === 2 };
    const planned = plan(target, options).items.map((item) => path.relative(target, item.path)).sort();
    assert.deepEqual(planned, [
      path.join("debug", "deps", ".tmpAbC.temp-archive"),
      path.join("debug", "deps", "fuyu_lib-0001.d"),
      path.join("debug", "deps", "fuyu_lib-0001.rlib"),
      path.join("debug", "incremental", "fuyu_lib-aaa"),
      path.join("debug", "incremental", "fuyu_lib-bbb"),
      "lane-7",
    ]);
    assert.ok(planned.every((item) => !item.includes("focusd")), "a crate's only build is its newest, so it stays");

    const dry = prune(target, { ...options, dryRun: true });
    assert.equal(dry.bytes, 6, "one byte in each of the six planned files");
    assert.ok(existsSync(at("lane-7")), "a dry run deletes nothing");

    const result = prune(target, options);
    assert.deepEqual(result.counts, { incremental: 2, own: 2, temp: 1, lane: 1 });
    assert.equal(existsSync(at("lane-7")), false);
    assert.equal(existsSync(at("debug", "incremental", "fuyu_lib-aaa")), false);
    for (const kept of [
      at("debug", "incremental", "fuyu_lib-ccc"), at("debug", "deps", "serde-0010.rlib"),
      at("lane-2", "debug", "fuyu.exe"), at("agents", "debug", "deps", "fuyu_lib-0005.rlib"), at("agents-d16"),
    ]) assert.ok(existsSync(kept), kept);
    assert.deepEqual(result.unknown, [{ name: "agents-d16", days: 6 }]);
    assert.match(summary(result), /^freed 0\.0 GB: .*not managed here: agents-d16 \(unused 6 d\)$/);
    assert.equal(summary(prune(target, options)).startsWith("nothing to delete"), true);
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});
