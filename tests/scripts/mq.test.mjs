import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { parseRefUpdates, pushBlock } from "../../scripts/mq/checkPush.mjs";
import { land, landRefusal, uncommittedNote } from "../../scripts/mq/land.mjs";
import { batchAdvice } from "../../scripts/mq/mq.mjs";
import { failedChecks, landBranchName, prText } from "../../scripts/mq/github.mjs";
import { queueOrder, updateBehind } from "../../scripts/mq/updateBehind.mjs";
import { waitFor } from "../../scripts/mq/wait.mjs";
import { lockfileChanged, removedDependencies } from "../../scripts/mq/sync.mjs";

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

test("land runs from local main or any branch, and leaves uncommitted files to whoever is editing them", () => {
  assert.equal(landRefusal("main"), null);
  assert.equal(landRefusal("feat/x"), null);
  assert.match(landRefusal("HEAD"), /detached HEAD/);
  assert.match(uncommittedNote([" M a.ts", "?? scratch.txt", ""]), /1 个没提交的改动/);
  assert.equal(uncommittedNote(["?? scratch.txt", ""]), null);
});

test("a batch is due after five commits or six hours, not after each small change", () => {
  const now = Date.parse("2026-11-13T12:00:00Z");
  const at = (hours) => now - hours * 3_600_000;
  assert.equal(batchAdvice([], now).due, false);
  assert.equal(batchAdvice([{ subject: "fix: typo", at: at(1) }], now).due, false);
  assert.match(batchAdvice([1, 2, 3, 4, 5].map(() => ({ subject: "x", at: at(1) })), now).reason, /攒了 5 个提交/);
  assert.match(batchAdvice([{ subject: "x", at: at(7) }], now).reason, /7 小时没推/);
});

test("dependencies are reinstalled only for a lockfile change, and never over a removed package", () => {
  assert.equal(lockfileChanged(["src/a.ts", "pnpm-lock.yaml"]), true);
  assert.equal(lockfileChanged(["package.json"]), false);
  assert.deepEqual(removedDependencies(new Set(["a", "b"]), new Set(["a", "c"])), ["b"]);
});

test("the land branch is unique per account, machine and lane, and the PR text comes from the commits", () => {
  assert.equal(landBranchName("TixXin", "TixxindeMacBook-Air.local", "lane/3"), "land/TixXin/tixxindemacbook-air-lane-3");
  assert.equal(landBranchName("ShengLin1001", "DESKTOP-AB12", "feat/x y"), "land/ShengLin1001/desktop-ab12-feat-x-y");
  assert.deepEqual(prText([{ subject: "fix(a): one", body: "why\n" }], "lane/1", { body: "## 改了什么\n\n- 一\n" }), {
    title: "fix(a): one",
    body: "## 改了什么\n\n- 一\n\n---\n由 `pnpm mq:land` 从 `lane/1` 开出，CI 通过后自动合入。",
  });
  const many = prText([{ subject: "first", body: "" }, { subject: "second", body: "b" }], "lane/1");
  assert.equal(many.title, "first");
  assert.match(many.body, /^## 改了什么\n\n> land 时没有给中文说明/);
  assert.match(many.body, /- `first`\n- `second`/);
  assert.equal(prText([{ subject: "first", body: "" }], "lane/1", { title: "feat: overall" }).title, "feat: overall");
  assert.deepEqual(failedChecks([
    { name: "scope", conclusion: "SUCCESS" },
    { name: "rust", status: "IN_PROGRESS", conclusion: null },
    { name: "check", conclusion: "FAILURE", detailsUrl: "u" },
    { context: "legacy", state: "ERROR", targetUrl: "t" },
  ]), [{ name: "check", url: "u" }, { name: "legacy", url: "t" }]);
});

function fakeGitHub() {
  const calls = { created: [], autoMerged: [], updated: [], edited: [] };
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
    editPr: (pr) => calls.edited.push(pr),
    autoMerge: (number) => calls.autoMerged.push(number),
    updateBranch: (number) => calls.updated.push(number),
  };
}

test("land merges main in without rewriting anything, pushes local main to its own branch, opens one PR with auto-merge, and backs out of a conflict", () => withoutGitEnv(async () => {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "mq-land-")));
  const git = (args, cwd) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const remote = path.join(root, "remote.git");
  const main = path.join(root, "app");
  const other = path.join(root, "other");
  const subjects = (ref, cwd = remote) => git(["log", "--no-merges", "--format=%s", ref], cwd).split("\n").sort();
  const commit = (cwd, file, text, message) => {
    writeFileSync(path.join(cwd, file), text);
    git(["add", file], cwd);
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
    writeFileSync(path.join(main, "b.txt"), "b\n");
    git(["add", "b.txt"], main);
    git(["commit", "-q", "-m", "local work", "-m", "because"], main);
    commit(other, "c.txt", "c\n", "someone else landed");
    git(["push", "-q", "origin", "main"], other);
    writeFileSync(path.join(main, "a.txt"), "another session is still editing this\n");
    const before = git(["rev-parse", "HEAD"], main);

    process.chdir(main);
    const gh = fakeGitHub();
    const branch = "land/tester/test-pc-main";
    assert.equal(await land({ github: gh, host: "Test-PC" }), 0);
    assert.deepEqual(subjects(branch), ["local work", "one", "someone else landed"], "main was merged in and local main pushed to its own branch");
    assert.equal(git(["merge-base", "--is-ancestor", before, "HEAD"], main), "", "the local commits were not rewritten");
    assert.deepEqual(subjects("main"), ["one", "someone else landed"], "main itself is left to the PR");
    assert.equal(git(["status", "--porcelain", "--untracked-files=no"], main), "M a.txt", "the other session's edit stays where it was");
    assert.equal(git(["show", `${branch}:a.txt`], remote), "a", "and is not pushed");
    assert.deepEqual(gh.calls.created.map(({ head, base, title }) => [head, base, title]), [[branch, "main", "local work"]]);
    assert.match(gh.calls.created[0].body, /- `local work`/);
    assert.match(gh.calls.created[0].body, /`b\.txt`/, "the skeleton lists what changed");
    assert.doesNotMatch(gh.calls.created[0].body, /Merge/, "merge commits are left out of the list");
    assert.deepEqual(gh.calls.autoMerged, [7]);

    commit(main, "e.txt", "e\n", "follow-up");
    assert.equal(await land({ github: gh, host: "Test-PC" }), 0);
    assert.ok(subjects(branch).includes("follow-up"), "the open PR's branch moved on");
    assert.equal(gh.calls.created.length, 1, "the open PR is reused");
    assert.deepEqual(gh.calls.edited, [], "a re-land without --body keeps the PR text");
    const bodyFile = path.join(root, "body.md");
    writeFileSync(bodyFile, "## 改了什么\n\n- 中文说明\n");
    assert.equal(await land({ github: gh, host: "Test-PC", bodyFile }), 0);
    assert.equal(gh.calls.edited.length, 1);
    assert.match(gh.calls.edited[0].body, /^## 改了什么\n\n- 中文说明\n\n---\n由 `pnpm mq:land`/);
    assert.equal(await land({ github: gh, host: "Test-PC", bodyFile: path.join(root, "missing.md") }), 1);
    assert.deepEqual(gh.calls.autoMerged, [7, 7, 7], "a missing body file stops before pushing");

    git(["pull", "-q", "--no-rebase", "origin", "main"], other);
    commit(other, "b.txt", "theirs\n", "conflicting");
    git(["push", "-q", "origin", "main"], other);
    commit(main, "b.txt", "mine\n", "mine");
    assert.equal(await land({ github: gh, host: "Test-PC" }), 1);
    assert.equal(git(["status", "--porcelain", "--untracked-files=no"], main), "M a.txt", "the merge was aborted; only the other session's edit is left");
    assert.equal(git(["log", "-1", "--format=%s"], main), "mine");
    assert.equal(gh.calls.autoMerged.length, 3, "nothing was pushed or merged after the conflict");
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
