import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { acquireBrowsers, browserCap, isRegression, wantedBrowsers, withBrowsers } from "../../scripts/heavy/browsers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const scratch = () => mkdtempSync(path.join(os.tmpdir(), "heavy-browsers-"));

function hold(dir, name, owner) {
  mkdirSync(path.join(dir, name), { recursive: true });
  writeFileSync(path.join(dir, name, "owner.json"), JSON.stringify(owner));
}

test("the machine-wide browser cap follows the env and otherwise half the cores, at least two", () => {
  assert.equal(browserCap({ FUYU_HEAVY_BROWSERS: "7" }, 10), 7);
  assert.equal(browserCap({}, 10), 5);
  assert.equal(browserCap({}, 2), 2);
  assert.equal(browserCap({ FUYU_HEAVY_BROWSERS: "many" }, 16), 8);
});

test("only the regression runner goes to the browser pool", () => {
  assert.equal(isRegression(["node", "scripts/run-regression.mjs", "settings"]), true);
  assert.equal(isRegression(["node", "C:\\r\\scripts\\run-regression.mjs"]), true);
  assert.equal(isRegression(["cargo", "test"]), false);
  assert.equal(isRegression(["node", "scripts/build-exe.mjs"]), false);
});

test("the browsers asked for come from --jobs, then REGRESSION_JOBS, then one", () => {
  assert.equal(wantedBrowsers(["node", "r.mjs", "--jobs", "3", "settings"], {}), 3);
  assert.equal(wantedBrowsers(["node", "r.mjs"], { REGRESSION_JOBS: "2" }), 2);
  assert.equal(wantedBrowsers(["node", "r.mjs", "--jobs", "4"], { REGRESSION_JOBS: "2" }), 4);
  assert.equal(wantedBrowsers(["node", "r.mjs"], {}), 1);
});

test("the runner is told how many browsers it got", () => {
  assert.deepEqual(withBrowsers(["node", "r.mjs", "--jobs", "3", "settings"], 2), ["node", "r.mjs", "--jobs", "2", "settings"]);
  assert.deepEqual(withBrowsers(["node", "r.mjs", "settings"], 1), ["node", "r.mjs", "settings", "--jobs", "1"]);
});

test("a run takes the free browsers when fewer are free than it asked for, and gives them back", () => {
  const dir = scratch();
  try {
    const browsers = path.join(dir, "browsers");
    for (const index of [0, 1, 2]) hold(browsers, `browser-${index}`, { pid: 4242, label: "test:regression", since: 0 });
    const { granted, release } = acquireBrowsers({ label: "test:changed", want: 3, dir, cap: 5, isAlive: () => true, log: () => {} });
    assert.equal(granted, 2);
    assert.equal(readdirSync(browsers).length, 5);
    release();
    assert.deepEqual(readdirSync(browsers).sort(), ["browser-0", "browser-1", "browser-2"]);
    assert.deepEqual(readdirSync(path.join(dir, "browser-queue")), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("when every browser is in use the run waits and says who holds them", () => {
  const dir = scratch();
  try {
    const browsers = path.join(dir, "browsers");
    for (const index of [0, 1]) hold(browsers, `browser-${index}`, { pid: 4242, label: "mq:verify", since: 0 });
    const notes = [];
    let polls = 0;
    const isAlive = (pid) => pid !== 4242 || polls < 2;
    const { granted, release } = acquireBrowsers({ label: "test:changed", want: 3, dir, cap: 2, isAlive, log: (line) => notes.push(line), sleep: () => (polls += 1), now: () => 60_000 * (polls + 1) });
    assert.equal(polls, 2);
    assert.equal(granted, 2);
    assert.match(notes[0], /最多开 2 个回归页浏览器.*mq:verify（2 个，\d+ 分钟，pid 4242）；你排在第 1 位/);
    release();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("regression pages do not wait for a Rust build holding every heavy slot", () => {
  const dir = scratch();
  try {
    hold(path.join(dir, "slots"), "slot-0", { pid: process.pid, label: "cargo test", lane: "target:agents", since: Date.now() });
    const printArgs = "console.log('ARGS ' + process.argv.slice(1).join(' '))";
    const result = spawnSync(process.execPath, ["scripts/heavy/heavy.mjs", "--label", "test:regression", "--", process.execPath, "-e", printArgs, "scripts/run-regression.mjs", "--jobs", "3", "settings"], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 20_000,
      env: { ...process.env, FUYU_HEAVY: "", FUYU_HEAVY_DIR: dir, FUYU_HEAVY_SLOTS: "1", FUYU_HEAVY_BROWSERS: "2" },
    });
    assert.equal(result.signal, null, "heavy kept waiting for the Rust slot");
    assert.equal(result.status, 0);
    assert.match(result.stdout, /ARGS scripts\/run-regression\.mjs --jobs 2 settings/);
    assert.match(result.stdout, /回归页开 2 个浏览器（要 3 个，全机器最多 2 个/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
