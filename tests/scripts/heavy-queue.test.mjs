import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parseArgs } from "../../scripts/heavy/heavy.mjs";
import { acquire, canRun, laneOf, readSlots, slotCount, waitingNote } from "../../scripts/heavy/queue.mjs";

const scratch = () => mkdtempSync(path.join(os.tmpdir(), "heavy-"));

test("slot count follows the env and otherwise one per five cores", () => {
  assert.equal(slotCount({ FUYU_HEAVY_SLOTS: "3" }, 10), 3);
  assert.equal(slotCount({}, 10), 2);
  assert.equal(slotCount({}, 4), 1);
  assert.equal(slotCount({ FUYU_HEAVY_SLOTS: "zero" }, 16), 3);
});

test("a waiter runs only when a slot is free and nobody earlier still waits for it", () => {
  assert.equal(canRun({ slots: 2, held: 0, ahead: 0 }), true);
  assert.equal(canRun({ slots: 2, held: 1, ahead: 0 }), true);
  assert.equal(canRun({ slots: 2, held: 1, ahead: 1 }), false);
  assert.equal(canRun({ slots: 2, held: 2, ahead: 0 }), false);
});

test("acquire takes a free slot and release gives it back", () => {
  const dir = scratch();
  try {
    const release = acquire({ label: "cargo test", dir, slots: 1, log: () => {} });
    assert.deepEqual(readdirSync(path.join(dir, "slots")), ["slot-0"]);
    assert.deepEqual(readdirSync(path.join(dir, "queue")), []);
    release();
    assert.deepEqual(readdirSync(path.join(dir, "slots")), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a full machine makes the next job wait and say who is running", () => {
  const dir = scratch();
  try {
    mkdirSync(path.join(dir, "slots", "slot-0"), { recursive: true });
    writeFileSync(path.join(dir, "slots", "slot-0", "owner.json"), JSON.stringify({ pid: 4242, label: "build:exe", since: 0 }));
    const notes = [];
    let polls = 0;
    const isAlive = (pid) => pid !== 4242 || polls < 2;
    const release = acquire({ label: "verify", dir, slots: 1, isAlive, log: (line) => notes.push(line), sleep: () => (polls += 1), now: () => 60_000 * (polls + 1) });
    assert.equal(polls, 2);
    assert.match(notes[0], /正在跑：build:exe（\d+ 分钟，pid 4242）；你排在第 1 位/);
    release();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("slots left by dead processes or never claimed are cleaned up", () => {
  const dir = scratch();
  try {
    mkdirSync(path.join(dir, "slot-0"));
    writeFileSync(path.join(dir, "slot-0", "owner.json"), JSON.stringify({ pid: 1, label: "x", since: 0 }));
    mkdirSync(path.join(dir, "slot-1"));
    const held = readSlots(dir, { isAlive: () => false, now: () => Date.now() + 60_000 });
    assert.deepEqual(held, []);
    assert.equal(existsSync(path.join(dir, "slot-0")), false);
    assert.equal(existsSync(path.join(dir, "slot-1")), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the waiting note counts the queue position from one", () => {
  assert.match(waitingNote({ slots: 2, held: [], ahead: 2, now: 0 }), /正在跑：无；你排在第 3 位/);
});

test("arguments before -- are the wrapper's own, the rest is the command", () => {
  assert.deepEqual(parseArgs(["--label", "regression", "--", "node", "x.mjs", "settings"]), { label: "regression", lane: null, command: ["node", "x.mjs", "settings"] });
  assert.deepEqual(parseArgs(["--label", "build:exe", "--lane", "target:release", "--", "node", "b.mjs"]), { label: "build:exe", lane: "target:release", command: ["node", "b.mjs"] });
  assert.deepEqual(parseArgs(["cargo", "test"]), { label: "cargo test", lane: null, command: ["cargo", "test"] });
});

test("cargo jobs are put in the lane of the build folder they lock", () => {
  assert.equal(laneOf(["cargo", "test"], {}), "target:debug");
  assert.equal(laneOf(["cargo", "build", "--release"], {}), "target:release");
  assert.equal(laneOf(["cargo", "test"], { CARGO_TARGET_DIR: "/r/src-tauri/target/agents" }), "target:agents");
  assert.equal(laneOf(["cargo", "clippy", "--target-dir=/r/src-tauri/target/agents", "-r"], {}), "target:agents/release");
  assert.equal(laneOf(["cargo", "test", "--target-dir", "/r/src-tauri/target"], {}), "target:debug");
  assert.equal(laneOf(["node", "scripts/x.mjs"], { CARGO_TARGET_DIR: "/r/agents" }), null);
});

test("a job waits while another job holds its lane, and does not hold up other lanes", () => {
  const dir = scratch();
  try {
    mkdirSync(path.join(dir, "slots", "slot-0"), { recursive: true });
    writeFileSync(path.join(dir, "slots", "slot-0", "owner.json"), JSON.stringify({ pid: 4242, label: "build:exe", lane: "target:release", since: 0 }));
    mkdirSync(path.join(dir, "queue"), { recursive: true });
    writeFileSync(path.join(dir, "queue", "000000000000001-4343.json"), JSON.stringify({ pid: 4343, label: "build:exe", lane: "target:release", since: 1 }));
    const other = acquire({ label: "cargo test", lane: "target:agents", dir, slots: 2, log: () => {}, now: () => 10, isAlive: () => true });
    other();
    rmSync(path.join(dir, "queue", "000000000000001-4343.json"));
    const notes = [];
    let polls = 0;
    const isAlive = (pid) => pid !== 4242 || polls < 1;
    const same = acquire({ label: "build:exe", lane: "target:release", dir, slots: 2, isAlive, log: (line) => notes.push(line), sleep: () => (polls += 1), now: () => 60_000 * (polls + 1) });
    assert.equal(polls, 1);
    assert.match(notes[0], /同一个构建目录（target:release）/);
    same();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a lane is busy while an earlier ticket of the same lane still waits", () => {
  assert.equal(canRun({ slots: 2, held: 0, ahead: 0, laneBusy: true }), false);
});
