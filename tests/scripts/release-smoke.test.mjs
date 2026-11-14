import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { dispatchedRun, runOutcome, SMOKE_WORKFLOW, watchRun } from "../../scripts/release/smoke-test.mjs";

function fakeGh(script) {
  const calls = [];
  const run = (_command, args) => {
    calls.push(args[1]);
    const next = script.shift();
    return typeof next === "function" ? next(args) : next;
  };
  return { run, calls };
}

const watchFail = { status: 1, stdout: "", stderr: "HTTP 502" };
const view = (status, conclusion) => ({ status: 0, stdout: JSON.stringify({ status, conclusion }), stderr: "" });

test("a finished run's conclusion decides; anything else is still running", () => {
  assert.equal(runOutcome({ status: "completed", conclusion: "success" }), "success");
  assert.equal(runOutcome({ status: "completed", conclusion: "failure" }), "failed");
  assert.equal(runOutcome({ status: "completed", conclusion: "cancelled" }), "failed");
  assert.equal(runOutcome({ status: "in_progress", conclusion: "" }), "running");
  assert.equal(runOutcome(null), "running");
});

test("a watch that drops out on a GitHub error while the run goes on is watched again", () => {
  const { run, calls } = fakeGh([watchFail, view("in_progress", ""), { status: 0 }]);
  assert.equal(watchRun(run, { repo: "r", id: 7, interval: 1, pause: 0 }), true);
  assert.deepEqual(calls, ["watch", "view", "watch"]);
});

test("a run that really failed, or finished while the watch was lost, is taken as it ended", () => {
  assert.equal(watchRun(fakeGh([watchFail, view("completed", "failure")]).run, { repo: "r", id: 7, interval: 1, pause: 0 }), false);
  assert.equal(watchRun(fakeGh([watchFail, view("completed", "success")]).run, { repo: "r", id: 7, interval: 1, pause: 0 }), true);
});

test("when GitHub cannot even say how the run is going, it keeps trying and then gives up", () => {
  const { run, calls } = fakeGh(Array.from({ length: 40 }, (_, i) => (i % 4 === 0 ? watchFail : { status: 1, stdout: "", stderr: "HTTP 502" })));
  assert.equal(watchRun(run, { repo: "r", id: 7, interval: 1, attempts: 2, pause: 0 }), false);
  assert.deepEqual(calls, ["watch", "view", "view", "view", "watch", "view", "view", "view"]);
});

test("the smoke test's run is the newest dispatch made after starting it", () => {
  const since = Date.parse("2026-11-12T10:00:00Z");
  const runs = [
    { databaseId: 1, event: "workflow_dispatch", createdAt: "2026-11-12T09:00:00Z" },
    { databaseId: 2, event: "workflow_dispatch", createdAt: "2026-11-12T10:00:03Z" },
    { databaseId: 3, event: "push", createdAt: "2026-11-12T10:00:04Z" },
  ];
  assert.equal(dispatchedRun(runs, since).databaseId, 2);
  assert.equal(dispatchedRun(runs.slice(0, 1), since), null);
});

test("the workflow the release starts exists and runs the PowerShell check", () => {
  const workflow = new URL(`../../.github/workflows/${SMOKE_WORKFLOW}`, import.meta.url);
  assert.ok(existsSync(workflow));
  assert.match(readFileSync(workflow, "utf8"), /scripts\/release\/smoke-test\.ps1/);
  assert.ok(existsSync(new URL("../../scripts/release/smoke-test.ps1", import.meta.url)));
});
