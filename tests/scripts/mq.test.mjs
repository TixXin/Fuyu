import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { parseRefUpdates, pushBlock } from "../../scripts/mq/checkPush.mjs";
import { land, landRefusal } from "../../scripts/mq/land.mjs";
import { failedChecks, landBranchName, prText } from "../../scripts/mq/github.mjs";
import { queueOrder, updateBehind } from "../../scripts/mq/updateBehind.mjs";
import { waitFor } from "../../scripts/mq/wait.mjs";
import { lockfileChanged, removedDependencies } from "../../scripts/mq/sync.mjs";
import { createWorktree, removeWorktree } from "../../scripts/lanes/worktree-hooks.mjs";

function withoutGitEnv(work) {
  const saved = Object.keys(process.env).filter((name) => name.startsWith("GIT_")).map((name) => [name, process.env[name]]);
  for (const [name] of saved) delete process.env[name];
  const cwd = process.cwd();
  return Promise.resolve()
    .then(work)
    .finally(() => {
      process.chdir(cwd);
      for (const [name, value] of saved) process.env[name] = value;
    });
}

test("nobody pushes main directly, other branches go through, and an emergency lets anything through", () => {
  const updates = parseRefUpdates("refs/heads/lane/3 aaa refs/heads/main bbb\n\n");
  assert.deepEqual(updates, [{ localRef: "refs/heads/lane/3", localSha: "aaa", remoteRef: "refs/heads/main", remoteSha: "bbb" }]);
  assert.match(pushBlock(updates, {}), /pnpm mq:land/);
  assert.match(pushBlock(updates, { CLAUDE_CODE_MERGE_QUEUE_LANDING: "1" }), /pnpm mq:land/, "the old landing flag no longer opens main");
  assert.equal(pushBlock(parseRefUpdates("refs/heads/lane/3 a refs/heads/land/t/pc-lane-3 b"), {}), null);
  assert.equal(pushBlock(updates, { CLAUDE_CODE_MERGE_QUEUE_EMERGENCY_PUSH: "1" }), null);
  assert.equal(pushBlock(parseRefUpdates("refs/heads/pr-9 a refs/heads/pr-9 b"), {}), null);
});

test("land runs only from a lane branch with everything committed", () => {
  assert.match(landRefusal("main", []), /lane 的分支/);
  assert.match(landRefusal("HEAD", []), /lane 的分支/);
  assert.match(landRefusal("lane/2", [" M a.ts", "?? scratch.txt"]), /没提交的改动[\s\S]*a\.ts/);
  assert.equal(landRefusal("lane/2", ["?? scratch.txt", ""]), null, "untracked files do not block a rebase");
});

test("dependencies are reinstalled only for a lockfile change, and never over a removed package", () => {
  assert.equal(lockfileChanged(["src/a.ts", "pnpm-lock.yaml"]), true);
  assert.equal(lockfileChanged(["package.json"]), false);
  assert.deepEqual(removedDependencies(new Set(["a", "b"]), new Set(["a", "c"])), ["b"]);
});

test("the land branch is unique per account, machine and lane, and the PR text comes from the commits", () => {
  assert.equal(landBranchName("TixXin", "TixxindeMacBook-Air.local", "lane/3"), "land/TixXin/tixxindemacbook-air-lane-3");
  assert.equal(landBranchName("ShengLin1001", "DESKTOP-AB12", "feat/x y"), "land/ShengLin1001/desktop-ab12-feat-x-y");
  assert.deepEqual(prText([{ subject: "fix(a): one", body: "why\n" }], "lane/1"), { title: "fix(a): one", body: "why\n\n由 `pnpm mq:land` 从 `lane/1` 开出，CI 通过后自动合入。" });
  const many = prText([{ subject: "first", body: "" }, { subject: "second", body: "b" }], "lane/1");
  assert.equal(many.title, "first");
  assert.match(many.body, /^- first\n- second\n/);
  assert.deepEqual(failedChecks([
    { name: "scope", conclusion: "SUCCESS" },
    { name: "rust", status: "IN_PROGRESS", conclusion: null },
    { name: "check", conclusion: "FAILURE", detailsUrl: "u" },
    { context: "legacy", state: "ERROR", targetUrl: "t" },
  ]), [{ name: "check", url: "u" }, { name: "legacy", url: "t" }]);
});

function fakeGitHub() {
  const calls = { created: [], autoMerged: [], updated: [] };
  const prs = new Map();
  return {
    calls,
    login: () => "tester",
    findPr: (head) => prs.get(head) ?? null,
    createPr: (pr) => {
      calls.created.push(pr);
      const created = { number: 7, url: "https://example.invalid/pull/7" };
      prs.set(pr.head, created);
      return created;
    },
    autoMerge: (number) => calls.autoMerged.push(number),
    updateBranch: (number) => calls.updated.push(number),
  };
}

test("land rebases onto main, pushes its own branch, opens one PR with auto-merge, and backs out of a conflict", () => withoutGitEnv(async () => {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "mq-land-")));
  const git = (args, cwd) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const remote = path.join(root, "remote.git");
  const main = path.join(root, "app");
  const lane = path.join(root, "app-lanes", "1");
  const other = path.join(root, "other");
  const remoteLog = (ref) => git(["log", "--format=%s", ref], remote);
  const commit = (cwd, file, text, message) => {
    writeFileSync(path.join(cwd, file), text);
    git(["add", "."], cwd);
    git(["commit", "-q", "-m", message], cwd);
  };
  try {
    git(["init", "-q", "--bare", "-b", "main", remote], root);
    git(["clone", "-q", remote, main], root);
    git(["config", "user.email", "t@t"], main);
    git(["config", "user.name", "t"], main);
    assert.ok(path.resolve(main, git(["rev-parse", "--git-dir"], main)).startsWith(root + path.sep), "git must run in the temp repo");
    commit(main, "a.txt", "a\n", "one");
    git(["push", "-q", "origin", "main"], main);
    git(["clone", "-q", remote, other], root);
    git(["worktree", "add", "-q", lane, "-b", "lane/1"], main);
    writeFileSync(path.join(lane, "b.txt"), "b\n");
    git(["add", "."], lane);
    git(["commit", "-q", "-m", "lane work", "-m", "because"], lane);
    commit(other, "c.txt", "c\n", "someone else landed");
    git(["push", "-q", "origin", "main"], other);

    process.chdir(lane);
    const gh = fakeGitHub();
    const branch = "land/tester/test-pc-lane-1";
    assert.equal(await land({ github: gh, host: "Test-PC" }), 0);
    assert.equal(remoteLog(branch), "lane work\nsomeone else landed\none", "rebased onto main and pushed to its own branch");
    assert.equal(remoteLog("main"), "someone else landed\none", "main itself is left to the PR");
    assert.deepEqual(gh.calls.created.map(({ head, base, title }) => [head, base, title]), [[branch, "main", "lane work"]]);
    assert.match(gh.calls.created[0].body, /^because/);
    assert.deepEqual(gh.calls.autoMerged, [7]);

    commit(other, "d.txt", "d\n", "more on main");
    git(["push", "-q", "origin", "main"], other);
    commit(lane, "e.txt", "e\n", "follow-up");
    assert.equal(await land({ github: gh, host: "Test-PC" }), 0);
    assert.equal(remoteLog(branch), "follow-up\nlane work\nmore on main\nsomeone else landed\none", "the rebased branch replaced the old one");
    assert.equal(gh.calls.created.length, 1, "the open PR is reused");
    assert.deepEqual(gh.calls.autoMerged, [7, 7]);

    git(["pull", "-q", "--rebase", "origin", "main"], other);
    commit(other, "b.txt", "theirs\n", "conflicting");
    git(["push", "-q", "origin", "main"], other);
    commit(lane, "b.txt", "mine\n", "mine");
    assert.equal(await land({ github: gh, host: "Test-PC" }), 1);
    assert.equal(git(["status", "--porcelain"], lane), "", "the rebase was aborted and the tree left clean");
    assert.equal(git(["log", "-1", "--format=%s"], lane), "mine");
    assert.equal(gh.calls.autoMerged.length, 2, "nothing was pushed or merged after the conflict");
  } finally {
    try {
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch {
      console.warn(`could not remove ${root}`);
    }
  }
}));

test("wait updates a PR that fell behind and reports the merge, a failed check or a conflict", async () => {
  const run = async (states, updateBehind = true) => {
    const gh = { ...fakeGitHub(), view: () => states.shift() };
    const merged = [];
    const code = await waitFor(7, { github: gh, sleep: async () => {}, onMerged: (sha) => { merged.push(sha); }, updateBehind });
    return { code, merged, updated: gh.calls.updated };
  };
  const open = (mergeStateStatus, statusCheckRollup = []) => ({ state: "OPEN", mergeStateStatus, statusCheckRollup, url: "u" });
  assert.deepEqual(await run([open("BEHIND"), open("BLOCKED", [{ name: "check", status: "IN_PROGRESS" }]), { state: "MERGED", mergeCommit: { oid: "abc123" } }]), { code: 0, merged: ["abc123"], updated: [7] });
  assert.deepEqual(await run([open("BLOCKED", [{ name: "check", conclusion: "FAILURE", detailsUrl: "x" }])]), { code: 1, merged: [], updated: [] });
  assert.deepEqual(await run([open("BEHIND"), { state: "MERGED", mergeCommit: { oid: "d" } }], false), { code: 0, merged: ["d"], updated: [] }, "the workflow updates behind PRs, so wait leaves them alone by default");
  assert.deepEqual(await run([open("DIRTY")]), { code: 1, merged: [], updated: [] });
  assert.deepEqual(await run([{ state: "CLOSED", url: "u" }]), { code: 1, merged: [], updated: [] });
});

test("only the first PR in line is brought up to date; drafts, conflicts and failed checks step aside", () => {
  const pr = (number, enabledAt, extra = {}) => ({ number, headRefOid: `sha${number}`, isDraft: false, mergeable: "MERGEABLE", statusCheckRollup: [], autoMergeRequest: enabledAt && { enabledAt }, ...extra });
  const prs = [
    pr(5, "2026-11-13T03:00:00Z"),
    pr(3, "2026-11-13T01:00:00Z", { statusCheckRollup: [{ name: "check", conclusion: "FAILURE" }] }),
    pr(4, "2026-11-13T02:00:00Z"),
    pr(2, "2026-11-13T00:30:00Z", { mergeable: "CONFLICTING" }),
    pr(1, "2026-11-13T00:00:00Z", { isDraft: true }),
    pr(6, null),
  ];
  assert.deepEqual(queueOrder(prs).map(({ number }) => number), [4, 5]);
  const run = (behind) => {
    const updated = [];
    const lines = [];
    const code = updateBehind({ github: { openPrs: () => prs, mainSha: () => "main", behindBy: (base, head) => (head === "sha4" ? behind : 9), updateBranch: (number) => updated.push(number) }, log: (line) => lines.push(line) });
    return { code, updated, said: lines.join("\n") };
  };
  assert.deepEqual(run(2).updated, [4], "the earliest behind PR is updated, the next one waits");
  const current = run(0);
  assert.deepEqual(current.updated, [], "nothing is updated while the first in line is current");
  assert.match(current.said, /#4 已经基于最新的 main/);
});

test("the worktree hooks hand out lanes and keep a lane with work from being removed", () => {
  const main = path.join("E:", "Projects", "fly-island");
  const asked = [];
  const sessionsDir = mkdtempSync(path.join(tmpdir(), "mq-sessions-"));
  writeFileSync(path.join(sessionsDir, `${process.pid}.json`), JSON.stringify({ pid: process.pid, sessionId: "s1", name: "fly-island-c5" }));
  try {
    const created = createWorktree({ cwd: main, session_id: "s1" }, { main, env: {}, sessionsDir, open: (options) => { asked.push(options); return { wt: "E:\\lane\\3" }; } });
    assert.deepEqual(created, { code: 0, stdout: "E:\\lane\\3" });
    assert.deepEqual([asked[0].pid, asked[0].session, asked[0].name, asked[0].install], [process.pid, "s1", "fly-island-c5", true], "the session's name and pid come from ~/.claude/sessions");
  } finally {
    rmSync(sessionsDir, { recursive: true, force: true });
  }

  const lanePath = path.join("E:", "Projects", "fly-island-lanes", "3");
  const clean = removeWorktree({ worktree_path: lanePath }, { main, finish: () => ({ released: true, problems: [] }) });
  assert.equal(clean.code, 0, "released and kept on disk for the next session");
  const dirty = removeWorktree({ worktree_path: lanePath }, { main, finish: () => ({ released: false, problems: ["1 个未提交的文件"], files: [" M a.ts"] }) });
  assert.equal(dirty.code, 1, "a non-zero exit makes Claude Code keep the worktree");
  assert.match(dirty.stderr, /1 个未提交的文件[\s\S]*a\.ts/);
  assert.equal(removeWorktree({ worktree_path: path.join("E:", "elsewhere") }, { main }).code, 0);
});
