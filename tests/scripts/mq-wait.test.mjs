import assert from "node:assert/strict";
import test from "node:test";
import { failedPages, flakyReport, idsFromUrl } from "../../scripts/mq/flaky.mjs";
import { isNetworkError } from "../../scripts/mq/github.mjs";
import { waitFor } from "../../scripts/mq/wait.mjs";

async function captured(work) {
  const original = { log: console.log, error: console.error };
  const said = [];
  console.log = (...args) => said.push(args.join(" "));
  console.error = (...args) => said.push(args.join(" "));
  try {
    return { result: await work(), said: said.join("\n") };
  } finally {
    Object.assign(console, original);
  }
}

const ghError = (stderr) => Object.assign(new Error("Command failed: gh pr view 7"), { stderr });
const EOF = 'Post "https://api.github.com/graphql": EOF';

test("network trouble from gh counts as retryable, a missing PR does not", () => {
  for (const stderr of [EOF, "read tcp 10.0.0.2:5123->140.82.112.6:443: read: connection reset by peer", "HTTP 502: Bad Gateway", "net/http: TLS handshake timeout", "dial tcp: lookup api.github.com: no such host"]) {
    assert.equal(isNetworkError(ghError(stderr)), true, stderr);
  }
  for (const stderr of ["GraphQL: Could not resolve to a PullRequest with the number of 99. (repository.pullRequest)", "HTTP 404: Not Found", "gh: To use GitHub CLI, please authenticate"]) {
    assert.equal(isNetworkError(ghError(stderr)), false, stderr);
  }
});

test("wait rides out a few network errors while reading the PR and still sees the merge", async () => {
  const replies = [ghError(EOF), ghError(EOF), { state: "MERGED", mergeCommit: { oid: "abc12345" } }];
  const pauses = [];
  const merged = [];
  const github = { view: () => { const next = replies.shift(); if (next instanceof Error) throw next; return next; } };
  const { result, said } = await captured(() => waitFor(7, { github, sleep: async (ms) => { pauses.push(ms); }, retryInterval: 1234, onMerged: (sha) => { merged.push(sha); } }));
  assert.equal(result, 0);
  assert.deepEqual(merged, ["abc12345"]);
  assert.deepEqual(pauses, [1234, 1234]);
  assert.match(said, /网络出错.*EOF.*（2\/5）/);
});

test("wait gives up after the retries run out, and other gh errors still surface", async () => {
  const github = { view: () => { throw ghError(EOF); } };
  const { result, said } = await captured(() => waitFor(7, { github, sleep: async () => {}, retries: 2 }));
  assert.equal(result, 1);
  assert.match(said, /连续 3 次读不到 PR #7 的状态/);
  const broken = { view: () => { throw ghError("HTTP 404: Not Found"); } };
  await assert.rejects(captured(() => waitFor(7, { github: broken, sleep: async () => {} })), /Command failed/);
});

const regressionLog = (...pages) => pages.map((page) => `regression\tBrowser regression pages\t2026-11-22T13:43:12Z ✗ ${page}  failed, 3 checks, 6.7s`).join("\n");

function history({ jobs, logs }) {
  return {
    ciRuns: () => [
      { databaseId: 100, headBranch: "land/TixXin/pc-main", conclusion: "failure", attempt: 2, url: "run/100" },
      { databaseId: 90, headBranch: "main", conclusion: "failure", attempt: 1, url: "run/90" },
      { databaseId: 80, headBranch: "land/TixXin/pc-main", conclusion: "success", attempt: 2, url: "run/80" },
      { databaseId: 70, headBranch: "fix/someone", conclusion: "failure", attempt: 1, url: "run/70" },
      { databaseId: 60, headBranch: "main", conclusion: "success", attempt: 1, url: "run/60" },
    ],
    attemptJobs: (run, attempt) => jobs[`${run}/${attempt}`] ?? [],
    jobLog: (job) => logs[job] ?? "",
  };
}

test("a failed regression page that also failed in recent main or land runs is called flaky; a new failure is not", () => {
  const failed = (job) => [{ id: job, name: "regression", conclusion: "failure" }];
  const github = history({
    jobs: { "90/1": failed(901), "80/1": failed(801), "80/2": failed(802), "70/1": failed(701), "60/1": failed(601) },
    logs: {
      1001: regressionLog("island-resize.html", "i18n.html?test=1"),
      901: regressionLog("island-resize.html"),
      801: regressionLog("island-resize.html"),
      802: regressionLog("island-resize.html"),
      701: regressionLog("i18n.html"),
      601: regressionLog("i18n.html"),
    },
  });
  const said = flakyReport(github, [{ name: "regression", url: "https://github.com/TixXin/fuyu/actions/runs/100/job/1001" }]).join("\n");
  assert.match(said, /island-resize\.html：疑似时好时坏，最近 main 和 land 的 CI 里挂过 2 次/, "main run 90 and the first attempt of land run 80; this PR's own run 100 is not history");
  assert.match(said, /i18n\.html：最近 main 和 land 的 CI 里没挂过/, "a feature branch and a passed attempt do not count");
  assert.match(said, /开任务/);
  assert.doesNotMatch(said, /gh run rerun/, "a page that never failed before keeps the run from being waved through");
  const onlyFlaky = flakyReport({ ...github, jobLog: (job) => (job === 1001 ? regressionLog("island-resize.html") : github.jobLog(job)) }, [{ name: "regression", url: "https://github.com/o/r/actions/runs/100/job/1001" }]).join("\n");
  assert.match(onlyFlaky, /gh run rerun 100 --failed/);
});

test("the flaky check stays out of the way of other failed checks and of GitHub hiccups", () => {
  assert.deepEqual(flakyReport({}, [{ name: "rust", url: "https://github.com/o/r/actions/runs/1/job/2" }]), []);
  const down = { jobLog: () => { throw ghError(EOF); } };
  assert.match(flakyReport(down, [{ name: "regression", url: "https://github.com/o/r/actions/runs/1/job/2" }]).join("\n"), /查不到回归页以前挂没挂过：.*EOF/);
  assert.deepEqual(failedPages("✓ a.html  passed\n✗ b.html  dark DOM differs\n✗ b.html  light island: 1 text(s)\nAll good ✗ nothing"), ["b.html"]);
  assert.deepEqual(idsFromUrl("https://github.com/o/r/actions/runs/45027671410/job/137226980573"), { run: 45027671410, job: 137226980573 });
});
