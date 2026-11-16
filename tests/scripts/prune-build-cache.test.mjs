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

test("a target folder loses old caches, old builds of the app and leftover lane previews, and keeps the rest", () => {
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
    touch(at("debug", "deps", "fuyu-0009.d"), 40);
    touch(at("debug", "deps", "serde-0010.rlib"), 90, "a dependency");
    touch(at("debug", "deps", ".tmpAbC.temp-archive"), 5);
    touch(at("agents", "debug", "deps", "fuyu_lib-0005.rlib"), 1);
    touch(at("lane-7", "debug", "fuyu.exe"), 8);
    touch(at("lane-build", "debug", "fuyu.exe"), 8);
    touch(at("agents-d16", "debug", "deps", "x.rlib"), 6);
    age(at("agents-d16"), 6);

    const options = { now: NOW, pressure: false };
    const planned = plan(target, options).items.map((item) => path.relative(target, item.path)).sort();
    assert.deepEqual(planned, [
      path.join("debug", "deps", ".tmpAbC.temp-archive"),
      path.join("debug", "deps", "fuyu_lib-0001.d"),
      path.join("debug", "deps", "fuyu_lib-0001.rlib"),
      path.join("debug", "incremental", "fuyu_lib-aaa"),
      path.join("debug", "incremental", "fuyu_lib-bbb"),
      "lane-7",
      "lane-build",
    ]);
    assert.ok(planned.every((item) => !item.includes("fuyu-0009")), "a crate's only build is its newest, so it stays");

    const dry = prune(target, { ...options, dryRun: true });
    assert.equal(dry.bytes, 7, "one byte in each of the seven planned files");
    assert.ok(existsSync(at("lane-7")), "a dry run deletes nothing");

    const result = prune(target, options);
    assert.deepEqual(result.counts, { incremental: 2, own: 2, temp: 1, lane: 2 });
    assert.equal(existsSync(at("lane-7")), false);
    assert.equal(existsSync(at("lane-build")), false);
    assert.equal(existsSync(at("debug", "incremental", "fuyu_lib-aaa")), false);
    for (const kept of [
      at("debug", "incremental", "fuyu_lib-ccc"), at("debug", "deps", "serde-0010.rlib"),
      at("agents", "debug", "deps", "fuyu_lib-0005.rlib"), at("agents-d16"),
    ]) assert.ok(existsSync(kept), kept);
    assert.deepEqual(result.unknown, [{ name: "agents-d16", days: 6 }]);
    assert.match(summary(result), /^freed 0\.0 GB: .*not managed here: agents-d16 \(unused 6 d\)$/);
    assert.equal(summary(prune(target, options)).startsWith("nothing to delete"), true);
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});

const HOUR = 60 * 60 * 1000;

function busyTarget() {
  const target = mkdtempSync(path.join(tmpdir(), "prune-busy-"));
  const deps = path.join(target, "agents", "debug", "deps");
  const hoursAgo = [0.2, 0.5, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  hoursAgo.forEach((hours, index) => {
    const file = path.join(deps, `fuyu_lib-${String(index).padStart(4, "0")}.rlib`);
    mkdirSync(deps, { recursive: true });
    writeFileSync(file, "x");
    const time = new Date(NOW - hours * HOUR);
    utimesSync(file, time, time);
  });
  for (const [name, days] of [["plugin_base-00aa.rlib", 0], ["plugin_base-00bb.rlib", 10], ["plugin_base-00bc.rlib", 11], ["plugin_base-00bd.rlib", 12], ["plugin_base-00be.rlib", 13], ["serde-00cc.rlib", 10], ["serde-00dd.rlib", 20], ["serde-00de.rlib", 21], ["serde-00df.rlib", 22]]) {
    const time = new Date(NOW - days * DAY);
    writeFileSync(path.join(deps, name), "x");
    utimesSync(path.join(deps, name), time, time);
  }
  const planned = (pressure) => plan(target, { now: NOW, pressure }).items.map((item) => path.basename(item.path)).sort();
  return { target, planned };
}

test("builds that pile up within a day are cut to the newest eight, and to three when the disk is low", () => {
  const { target, planned } = busyTarget();
  try {
    assert.deepEqual(planned(false), ["fuyu_lib-0008.rlib", "fuyu_lib-0009.rlib", "fuyu_lib-0010.rlib", "fuyu_lib-0011.rlib", "plugin_base-00bd.rlib", "plugin_base-00be.rlib"]);
    const low = planned(true);
    assert.deepEqual(low.filter((name) => name.startsWith("fuyu_lib")), ["fuyu_lib-0003", "fuyu_lib-0004", "fuyu_lib-0005", "fuyu_lib-0006", "fuyu_lib-0007", "fuyu_lib-0008", "fuyu_lib-0009", "fuyu_lib-0010", "fuyu_lib-0011"].map((name) => `${name}.rlib`));
    assert.ok(!low.some((name) => name.startsWith("serde")), "dependencies are never touched");
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});

test("anything built in the last hour stays, however many newer builds there are", () => {
  const { target } = busyTarget();
  const deps = path.join(target, "agents", "debug", "deps");
  try {
    for (let index = 20; index < 30; index += 1) {
      const file = path.join(deps, `fuyu_lib-${String(index).padStart(4, "0")}.rlib`);
      writeFileSync(file, "x");
      const time = new Date(NOW - 0.1 * HOUR);
      utimesSync(file, time, time);
    }
    const planned = plan(target, { now: NOW, pressure: true }).items.map((item) => path.basename(item.path));
    assert.ok(!planned.includes("fuyu_lib-0000.rlib") && !planned.includes("fuyu_lib-0001.rlib"), "12 and 30 minutes old stay");
    assert.ok(planned.includes("fuyu_lib-0002.rlib"), "two hours old goes once newer builds outnumber it");
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});
