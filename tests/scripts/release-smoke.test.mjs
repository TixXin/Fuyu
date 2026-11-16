import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { dispatchedRun, runOutcome, SMOKE_WORKFLOW, smokeTest, waitForJobs, watchRun } from "../../scripts/release/smoke-test.mjs";

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

function fakeRepo(jobCounts) {
  const calls = [];
  const runs = [];
  let nextId = 100;
  const run = (_command, args) => {
    const [group, verb] = args;
    calls.push(group === "api" ? `jobs ${args[1].split("/")[4]}` : `${group} ${verb}${verb === "cancel" ? ` ${args[2]}` : ""}`);
    if (group === "workflow") {
      runs.unshift({ databaseId: nextId, event: "workflow_dispatch", createdAt: new Date().toISOString(), url: `u/${nextId}` });
      nextId += 1;
      return { status: 0, stdout: "", stderr: "" };
    }
    if (verb === "list") return { status: 0, stdout: JSON.stringify(runs), stderr: "" };
    if (group === "api") {
      const id = Number(args[1].split("/")[4]);
      const counts = jobCounts[id - 100] ?? [];
      const answer = counts.length > 1 ? counts.shift() : counts[0];
      return answer === "error" ? { status: 1, stdout: "", stderr: "HTTP 502" } : { status: 0, stdout: `${answer}\n`, stderr: "" };
    }
    if (verb === "cancel") return { status: 0, stdout: "", stderr: "" };
    if (verb === "watch") return { status: 0, stdout: "", stderr: "" };
    throw new Error(`unexpected gh ${args.join(" ")}`);
  };
  return { run, calls };
}

const quick = { findPause: 0, jobPolls: 3, pause: 0 };

test("a run that gets its job after a while is watched, never cancelled", () => {
  const { run, calls } = fakeRepo([[0, 0, 1]]);
  assert.equal(smokeTest(run, "v1", "r", quick), null);
  assert.deepEqual(calls, ["workflow run", "run list", "jobs 100", "jobs 100", "jobs 100", "run watch"]);
});

test("a run GitHub never gives a job is cancelled and the smoke test started again", () => {
  const { run, calls } = fakeRepo([[0], [1]]);
  assert.equal(smokeTest(run, "v1", "r", quick), null);
  assert.deepEqual(calls, ["workflow run", "run list", "jobs 100", "jobs 100", "jobs 100", "run cancel 100", "workflow run", "run list", "jobs 101", "run watch"]);
});

test("after three runs without a job the release is left as a draft with a reason", () => {
  const { run, calls } = fakeRepo([[0], [0], [0]]);
  assert.match(smokeTest(run, "v1", "r", quick), /never gave the smoke test a job in 3 tries/);
  assert.deepEqual(calls.filter((call) => call.startsWith("run cancel")), ["run cancel 100", "run cancel 101", "run cancel 102"]);
  assert.ok(!calls.includes("run watch"));
});

test("when GitHub cannot say how many jobs a run has, the run is watched rather than cancelled", () => {
  assert.equal(waitForJobs(fakeRepo([["error"]]).run, { repo: "r", id: 100, polls: 3, pause: 0 }), true);
  assert.equal(waitForJobs(fakeRepo([["error", 0, "error"]]).run, { repo: "r", id: 100, polls: 3, pause: 0 }), false);
});

test("the workflow the release starts exists and runs the PowerShell check", () => {
  const workflow = new URL(`../../.github/workflows/${SMOKE_WORKFLOW}`, import.meta.url);
  assert.ok(existsSync(workflow));
  assert.match(readFileSync(workflow, "utf8"), /scripts\/release\/smoke-test\.ps1/);
  assert.ok(existsSync(new URL("../../scripts/release/smoke-test.ps1", import.meta.url)));
});
