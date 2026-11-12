import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { parseRefUpdates, pushBlock } from "../../scripts/mq/checkPush.mjs";
import { land, landRefusal } from "../../scripts/mq/land.mjs";
import { createQueueLock, liveTickets } from "../../scripts/mq/queueLock.mjs";
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

test("pushes to main need the landing flag, and an emergency lets anything through", () => {
  const updates = parseRefUpdates("refs/heads/lane/3 aaa refs/heads/main bbb\n\n");
  assert.deepEqual(updates, [{ localRef: "refs/heads/lane/3", localSha: "aaa", remoteRef: "refs/heads/main", remoteSha: "bbb" }]);
  assert.match(pushBlock(updates, {}), /pnpm mq:land/);
  assert.equal(pushBlock(updates, { CLAUDE_CODE_MERGE_QUEUE_LANDING: "1" }), null);
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

test("the queue is first come, first served, and a dead holder's lock is taken back", async () => {
  assert.deepEqual(liveTickets(["30-1", "10-3", "20-2", "5-9"], (pid) => pid !== 9), ["10-3", "20-2", "30-1"]);
  const dir = mkdtempSync(path.join(tmpdir(), "mq-queue-"));
  const other = spawn(process.execPath, ["-e", "setTimeout(() => {}, 20000)"], { stdio: "ignore" });
  try {
    writeFileSync(path.join(dir, "lock"), JSON.stringify({ pid: 999999, label: "gone", ts: 0 }));
    const first = createQueueLock(dir, { label: "first" });
    await first.acquire();
    assert.equal(first.held, true, "a lock whose holder exited is reclaimed");
    const second = createQueueLock(dir, { pid: other.pid, label: "second" });
    let waited = false;
    const turn = second.acquire({ onWait: () => { waited = true; } });
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.equal(second.held, false, "waits while the first holds the lock");
    assert.equal(waited, true);
    first.release();
    await turn;
    assert.equal(second.held, true);
    second.release();
  } finally {
    other.kill();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("land rebases onto main, pushes, fast-forwards the main checkout, and backs out of a conflict", () => withoutGitEnv(async () => {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "mq-land-")));
  const git = (args, cwd) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const remote = path.join(root, "remote.git");
  const main = path.join(root, "app");
  const lane = path.join(root, "app-lanes", "1");
  const other = path.join(root, "other");
  try {
    git(["init", "-q", "--bare", "-b", "main", remote], root);
    git(["clone", "-q", remote, main], root);
    assert.ok(path.resolve(main, git(["rev-parse", "--git-dir"], main)).startsWith(root + path.sep), "git must run in the temp repo");
    writeFileSync(path.join(main, "a.txt"), "a\n");
    git(["add", "."], main);
    git(["commit", "-q", "-m", "one"], main);
    git(["push", "-q", "origin", "main"], main);
    git(["clone", "-q", remote, other], root);
    git(["worktree", "add", "-q", lane, "-b", "lane/1"], main);
    writeFileSync(path.join(lane, "b.txt"), "b\n");
    git(["add", "."], lane);
    git(["commit", "-q", "-m", "lane work"], lane);
    writeFileSync(path.join(other, "c.txt"), "c\n");
    git(["add", "."], other);
    git(["commit", "-q", "-m", "someone else landed"], other);
    git(["push", "-q", "origin", "main"], other);

    process.chdir(lane);
    assert.equal(await land(), 0);
    assert.equal(git(["log", "--format=%s", "-3", "origin/main"], lane), "lane work\nsomeone else landed\none");
    assert.equal(git(["rev-parse", "HEAD"], main), git(["rev-parse", "origin/main"], main), "the main checkout was fast-forwarded");

    git(["pull", "-q", "--rebase", "origin", "main"], other);
    writeFileSync(path.join(other, "b.txt"), "theirs\n");
    git(["commit", "-q", "-am", "conflicting"], other);
    git(["push", "-q", "origin", "main"], other);
    writeFileSync(path.join(lane, "b.txt"), "mine\n");
    git(["commit", "-q", "-am", "mine"], lane);
    assert.equal(await land(), 1);
    assert.equal(git(["status", "--porcelain"], lane), "", "the rebase was aborted and the tree left clean");
    assert.equal(git(["log", "-1", "--format=%s"], lane), "mine");
  } finally {
    try {
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch {
      console.warn(`could not remove ${root}`);
    }
  }
}));

test("the worktree hooks hand out lanes and keep a lane with work from being removed", () => {
  const main = path.join("E:", "Projects", "fly-island");
  const asked = [];
  const created = createWorktree({ cwd: main, session_id: "s1" }, { main, env: { CLAUDE_PID: "42" }, open: (options) => { asked.push(options); return { wt: "E:\\lane\\3" }; } });
  assert.deepEqual(created, { code: 0, stdout: "E:\\lane\\3" });
  assert.deepEqual([asked[0].pid, asked[0].session, asked[0].install], [42, "s1", true]);

  const lanePath = path.join("E:", "Projects", "fly-island-lanes", "3");
  const clean = removeWorktree({ worktree_path: lanePath }, { main, finish: () => ({ released: true, problems: [] }) });
  assert.equal(clean.code, 0, "released and kept on disk for the next session");
  const dirty = removeWorktree({ worktree_path: lanePath }, { main, finish: () => ({ released: false, problems: ["1 个未提交的文件"], files: [" M a.ts"] }) });
  assert.equal(dirty.code, 1, "a non-zero exit makes Claude Code keep the worktree");
  assert.match(dirty.stderr, /1 个未提交的文件[\s\S]*a\.ts/);
  assert.equal(removeWorktree({ worktree_path: path.join("E:", "elsewhere") }, { main }).code, 0);
});
