import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { ciVerdict, runCi } from "../../scripts/mq/verifyCi.mjs";
import { failedPages, formatElapsed, heartbeatLines, lastLineOf, nextRecord, verificationRefusal, verifiedAt, verifyDirOf, verifyRequest } from "../../scripts/mq/verify.mjs";

const SHA = "a".repeat(40);
const NEXT = "b".repeat(40);
const all = (sha) => ({ sha, passed: { verify: { sha }, regression: { sha }, exe: { sha }, ci: { sha } }, failedPages: [] });

test("the verify worktree sits beside the main checkout and is named after it", () => {
  assert.equal(verifyDirOf(path.join("/work", "Fuyu")), path.join("/work", "Fuyu-verify"));
});

test("verify runs every step by default, a page list means only the regression pages", () => {
  assert.deepEqual(verifyRequest([]), { commit: null, steps: ["verify", "regression", "exe", "ci"], pages: [], force: false });
  assert.deepEqual(verifyRequest(["--no-ci"]).steps, ["verify", "regression", "exe"]);
  assert.deepEqual(verifyRequest(["--only", "ci"]).steps, ["ci"]);
  assert.match(verifyRequest(["--only", "ci", "--no-ci"]).error, /--no-ci/);
  assert.deepEqual(verifyRequest(["abc123", "--only", "verify,exe"]).steps, ["verify", "exe"]);
  assert.deepEqual(verifyRequest(["--pages", "todos-off", "settings"]), { commit: null, steps: ["regression"], pages: ["todos-off", "settings"], force: false });
  assert.match(verifyRequest(["--only", "lint"]).error, /--only/);
  assert.match(verifyRequest(["--only", "exe", "--pages", "x"]).error, /--pages/);
  assert.match(verifyRequest(["a", "b"]).error, /一个提交号/);
});

test("failed regression pages are read from the runner's ✗ lines", () => {
  const output = "✓ calendar.html  passed\n✗ todos-off.html  failed, 2 checks\n✗ todos-off.html  dark DOM differs\n✗ settings.html?test=1  failed";
  assert.deepEqual(failedPages(output), ["todos-off.html", "settings.html?test=1"]);
});

test("a full run records every step; a failed regression keeps its pages for a rerun", () => {
  const record = nextRecord(null, { sha: SHA, carry: false, pages: [], now: 1, results: [
    { step: "verify", ok: true }, { step: "exe", ok: true }, { step: "ci", ok: true }, { step: "regression", ok: false, failedPages: ["todos-off.html"] },
  ] });
  assert.equal(verifiedAt(record, SHA), false);
  assert.deepEqual(record.failedPages, ["todos-off.html"]);
  const rerun = nextRecord(record, { sha: SHA, carry: false, pages: ["todos"], now: 2, results: [{ step: "regression", ok: true }] });
  assert.equal(verifiedAt(rerun, SHA), true);
});

test("rerunning only some pages does not pass the regression step while other pages are still failing", () => {
  const record = { sha: SHA, passed: { verify: { sha: SHA }, exe: { sha: SHA }, ci: { sha: SHA } }, failedPages: ["todos-off.html", "settings.html?test=1"] };
  const partial = nextRecord(record, { sha: SHA, carry: false, pages: ["todos"], now: 2, results: [{ step: "regression", ok: true }] });
  assert.equal(verifiedAt(partial, SHA), false);
});

test("passes carry over to a later commit only when asked, and a new commit starts empty otherwise", () => {
  const carried = nextRecord(all(SHA), { sha: NEXT, carry: true, pages: [], now: 3, results: [{ step: "regression", ok: true }] });
  assert.equal(verifiedAt(carried, NEXT), true);
  assert.equal(carried.passed.verify.sha, SHA);
  const fresh = nextRecord(all(SHA), { sha: NEXT, carry: false, pages: [], now: 3, results: [{ step: "regression", ok: true }] });
  assert.equal(verifiedAt(fresh, NEXT), false);
});

test("land is refused until the commit it carries is verified, except for docs, --only and --unverified", () => {
  const files = ["src/a.ts"];
  assert.match(verificationRefusal({ record: null, target: SHA, files }), /pnpm mq:verify aaaaaaaaa/);
  assert.match(verificationRefusal({ record: all(NEXT), target: SHA, files }), /已过：无/);
  assert.equal(verificationRefusal({ record: all(SHA), target: SHA, files }), null);
  assert.equal(verificationRefusal({ record: null, target: SHA, files: ["docs/a.md", "AGENTS.md"] }), null);
  assert.equal(verificationRefusal({ record: null, target: SHA, files, unverified: true }), null);
  assert.equal(verificationRefusal({ record: null, target: SHA, files, only: true }), null);
});

test("the heartbeat shows each running step's elapsed time and its last plain output line", () => {
  assert.equal(lastLineOf("\x1b[32m✓ settings.html passed\x1b[0m\r\n\n"), "✓ settings.html passed");
  assert.equal(lastLineOf("  \n\r\n", "keep me"), "keep me");
  assert.equal(lastLineOf(`${"x".repeat(200)}\n`).length, 90);
  assert.equal(formatElapsed(5_400), "5秒");
  assert.equal(formatElapsed(372_000), "6分12秒");
  assert.deepEqual(heartbeatLines([{ step: "regression", start: 0, lastLine: "✓ a.html" }, { step: "exe", start: 60_000, lastLine: "" }], 90_000), [
    "  … regression 1分30秒 · ✓ a.html",
    "  … exe 30秒",
  ]);
});

test("land waits for CI too: a run with every local step passed but no ci is not verified, and --only ci completes it (D121.3)", () => {
  const local = nextRecord(null, { sha: SHA, carry: false, pages: [], now: 1, results: ["verify", "regression", "exe"].map((step) => ({ step, ok: true })) });
  assert.equal(verifiedAt(local, SHA), false);
  assert.match(verificationRefusal({ record: local, target: SHA, files: ["src/a.ts"] }), /已过：verify、regression、exe）/);
  assert.equal(verifiedAt(nextRecord(local, { sha: SHA, carry: false, pages: [], now: 2, results: [{ step: "ci", ok: true }] }), SHA), true);
  assert.equal(verifiedAt(nextRecord(local, { sha: SHA, carry: false, pages: [], now: 2, results: [{ step: "ci", ok: false }] }), SHA), false);
});

test("the CI verdict fails as soon as one job fails, passes only when every run of the commit has finished cleanly", () => {
  const running = { status: "in_progress", conclusion: "" };
  assert.deepEqual(ciVerdict([], []), { state: "none" });
  assert.deepEqual(ciVerdict([running], [{ name: "frontend (windows)", status: "completed", conclusion: "failure" }, { name: "rust", status: "in_progress", conclusion: "" }]), { state: "failed", failed: ["frontend (windows)"], finished: false });
  assert.deepEqual(ciVerdict([running], [{ name: "rust", status: "completed", conclusion: "success" }, { name: "regression", status: "queued", conclusion: "" }]), { state: "running", progress: "1/2 个 job 跑完" });
  assert.equal(ciVerdict([{ status: "completed", conclusion: "success" }], [{ name: "docs", status: "completed", conclusion: "skipped" }]).state, "passed");
  assert.equal(ciVerdict([{ status: "completed", conclusion: "cancelled" }], []).state, "failed", "a run cancelled by a later push on the same try branch does not count as passed");
});

function fakeCi(polls) {
  const removed = [];
  let poll = 0;
  const github = {
    runs: () => (polls[Math.min(poll, polls.length - 1)].runs),
    runJobs: () => polls[Math.min(poll, polls.length - 1)].jobs,
  };
  const pushed = [];
  const push = (options) => {
    pushed.push(options.head);
    return { rev: "c".repeat(40), remoteBranch: "try/tester/test-pc-main" };
  };
  const sleep = async () => {
    poll += 1;
  };
  return { github, push, sleep, removed, pushed, remote: { remove: (name) => removed.push(name) && null }, polls: () => poll };
}

const run = (status, conclusion = "") => ({ databaseId: 7, headSha: "c".repeat(40), status, conclusion, url: "https://ci/7" });

test("ci pushes the verified commit, waits for its run and deletes the try branch once CI passed", async () => {
  const fake = fakeCi([{ runs: [], jobs: [] }, { runs: [run("in_progress")], jobs: [{ name: "rust", status: "in_progress" }] }, { runs: [run("completed", "success")], jobs: [{ name: "rust", status: "completed", conclusion: "success" }] }]);
  const result = await runCi({ sha: SHA, ...fake, now: () => 0 });
  assert.equal(result.ok, true);
  assert.deepEqual(fake.pushed, [SHA], "the commit being verified is pushed, not whatever HEAD is");
  assert.equal(fake.polls(), 2);
  assert.deepEqual(fake.removed, ["try/tester/test-pc-main"]);
});

test("ci reports a failed job before the run finishes and keeps the branch until the run is done", async () => {
  const fake = fakeCi([{ runs: [{ ...run("in_progress"), headSha: "d".repeat(40) }], jobs: [] }, { runs: [run("in_progress")], jobs: [{ name: "frontend (windows)", status: "completed", conclusion: "failure" }] }]);
  const result = await runCi({ sha: SHA, ...fake, now: () => 0 });
  assert.equal(result.ok, false);
  assert.match(result.detail, /挂了：frontend \(windows\)（https:\/\/ci\/7）/);
  assert.match(result.detail, /pnpm mq:try --clean/);
  assert.deepEqual(fake.removed, [], "a run of an older push on the same branch is ignored, and a running branch is not deleted");
});

test("ci fails instead of waiting forever when no run shows up, and when the push itself fails", async () => {
  const fake = fakeCi([{ runs: [], jobs: [] }]);
  let clock = 0;
  const sleep = async () => {
    clock += 60_000;
  };
  const result = await runCi({ sha: SHA, ...fake, sleep, now: () => clock });
  assert.equal(result.ok, false);
  assert.match(result.detail, /没在 try\/tester\/test-pc-main 上跑起来/);
  const conflict = await runCi({ sha: SHA, ...fake, push: () => ({ error: "提交 aaaaaaaaa 和 origin/main 冲突" }) });
  assert.deepEqual(conflict, { ok: false, detail: "提交 aaaaaaaaa 和 origin/main 冲突" });
  const offline = await runCi({ sha: SHA, ...fake, push: () => { throw new Error("could not resolve host"); } });
  assert.match(offline.detail, /could not resolve host.*--no-ci/);
});
