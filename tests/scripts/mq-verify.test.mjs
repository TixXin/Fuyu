import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { failedPages, formatElapsed, heartbeatLines, lastLineOf, nextRecord, verificationRefusal, verifiedAt, verifyDirOf, verifyRequest } from "../../scripts/mq/verify.mjs";

const SHA = "a".repeat(40);
const NEXT = "b".repeat(40);
const all = (sha) => ({ sha, passed: { verify: { sha }, regression: { sha }, exe: { sha } }, failedPages: [] });

test("the verify worktree sits beside the main checkout and is named after it", () => {
  assert.equal(verifyDirOf(path.join("/work", "Fuyu")), path.join("/work", "Fuyu-verify"));
});

test("verify runs every step by default, a page list means only the regression pages", () => {
  assert.deepEqual(verifyRequest([]), { commit: null, steps: ["verify", "regression", "exe"], pages: [], force: false });
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
    { step: "verify", ok: true }, { step: "exe", ok: true }, { step: "regression", ok: false, failedPages: ["todos-off.html"] },
  ] });
  assert.equal(verifiedAt(record, SHA), false);
  assert.deepEqual(record.failedPages, ["todos-off.html"]);
  const rerun = nextRecord(record, { sha: SHA, carry: false, pages: ["todos"], now: 2, results: [{ step: "regression", ok: true }] });
  assert.equal(verifiedAt(rerun, SHA), true);
});

test("rerunning only some pages does not pass the regression step while other pages are still failing", () => {
  const record = { sha: SHA, passed: { verify: { sha: SHA }, exe: { sha: SHA } }, failedPages: ["todos-off.html", "settings.html?test=1"] };
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
