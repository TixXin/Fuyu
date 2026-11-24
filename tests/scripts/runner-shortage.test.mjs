import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { rerunStarved, runShortage, starvedRun } from "../../scripts/mq/runnerShortage.mjs";
import { waitFor } from "../../scripts/mq/wait.mjs";
import { downloadCiBuild } from "../../scripts/release/ci-build.mjs";
import { createClock } from "../../scripts/release/timing.mjs";

const NO_RUNNER = "The job was not acquired by Runner of type hosted even after multiple attempts";
const job = (name, id) => ({ name, url: `https://github.com/o/r/actions/runs/45/job/${id}` });
const notes = { 1: [NO_RUNNER, "Due to capacity constraints, jobs targeting macOS arm64 runners may experience longer queue times."], 2: [], 3: ["Process completed with exit code 1."] };

test("a run whose only failures are jobs GitHub never found a runner for, plus the gathering check, is starved", () => {
  const github = { annotations: (id) => notes[id] };
  assert.equal(starvedRun(github, [job("rust-macos", 1), job("check", 2)]), 45);
  assert.equal(starvedRun(github, [job("rust-macos", 1), job("frontend", 3), job("check", 2)]), null, "a real failure alongside is not rerun");
  assert.equal(starvedRun(github, [job("frontend", 3)]), null);
});

test("a starved run is rerun once it has finished; until then the wait goes on", () => {
  const reruns = [];
  const github = { annotations: (id) => notes[id], rerunFailed: (id) => reruns.push(id) };
  assert.equal(rerunStarved(github, [job("rust-macos", 1)], { log: () => {} }), "rerun");
  assert.deepEqual(reruns, [45]);
  const busy = { annotations: (id) => notes[id], rerunFailed: () => { throw new Error("run 45 cannot be rerun; it is still in progress"); } };
  assert.equal(rerunStarved(busy, [job("rust-macos", 1)], { log: () => {} }), "pending");
  assert.equal(rerunStarved({ view: () => null }, [job("rust-macos", 1)], { log: () => {} }), null, "without annotations it falls back to reporting the failure");
});

test("mq:wait reruns a PR whose Mac check got no runner and goes on to the merge", async () => {
  const cancelled = { state: "OPEN", statusCheckRollup: [{ name: "rust-macos", conclusion: "CANCELLED", detailsUrl: job("rust-macos", 1).url }, { name: "check", conclusion: "FAILURE", detailsUrl: job("check", 2).url }] };
  const views = [cancelled, { state: "OPEN", statusCheckRollup: [] }, { state: "MERGED", mergeCommit: { oid: "eb0b266a" } }];
  const reruns = [];
  const github = { view: () => views.shift(), annotations: (id) => notes[id], rerunFailed: (id) => reruns.push(id) };
  const log = console.log;
  console.log = () => {};
  try {
    assert.equal(await waitFor(1235, { github, sleep: async () => {}, onMerged: () => {} }), 0);
  } finally {
    console.log = log;
  }
  assert.deepEqual(reruns, [45]);
});

test("the release reruns a CI build GitHub cancelled for lack of a runner, then downloads it", () => {
  const dir = mkdtempSync(join(tmpdir(), "fuyu-shortage-"));
  try {
    const watches = [1, 0];
    const run = (_command, args) => ({ status: args[1] === "watch" ? watches.shift() : 0, stdout: args[1] === "view" ? JSON.stringify({ status: "completed", conclusion: "cancelled" }) : "", stderr: "" });
    const asked = [];
    const shortage = (_run, repo, id) => asked.push(`${repo}#${id}`) > 0;
    const log = console.log;
    console.log = () => {};
    try {
      const problem = downloadCiBuild(run, { workflow: "w", label: "macOS", repo: "o/r", artifact: "a", runId: 8, dir, clock: createClock({ log: () => {} }), wait: () => {}, shortage });
      assert.equal(problem, null);
    } finally {
      console.log = log;
    }
    assert.deepEqual(asked, ["o/r#8"]);
    const refused = downloadCiBuild((_command, args) => ({ status: args[1] === "watch" ? 1 : 0, stdout: JSON.stringify({ status: "completed", conclusion: "cancelled" }), stderr: "" }), { workflow: "w", label: "macOS", repo: "o/r", artifact: "a", runId: 8, dir, clock: createClock({ log: () => {} }), wait: () => {}, shortage: () => false });
    assert.match(refused, /the macOS build failed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runShortage reads the run's unfinished jobs and their annotations through gh", () => {
  const calls = [];
  const run = (_command, args) => {
    calls.push(args.slice(0, 2).join(" "));
    if (args[1] === "repos/o/r/actions/runs/8/jobs") return { status: 0, stdout: JSON.stringify([{ id: 1, name: "build" }]) };
    if (args[1] === "repos/o/r/check-runs/1/annotations") return { status: 0, stdout: JSON.stringify([NO_RUNNER]) };
    return { status: 0, stdout: "" };
  };
  assert.equal(runShortage(run, "o/r", 8), true);
  assert.deepEqual(calls, ["api repos/o/r/actions/runs/8/jobs", "api repos/o/r/check-runs/1/annotations", "run rerun"]);
});
