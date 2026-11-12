import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { laneOf, lanePath, ownerOf } from "../../scripts/lanes/laneRegistry.mjs";
import { ACTIVE_MS, judge, usable } from "../../scripts/lanes/laneState.mjs";
import { listLanes, openLane, releaseLane, takeLane } from "../../scripts/lanes/lanePool.mjs";
import { listLine } from "../../scripts/lanes/lanes.mjs";

const NOW = Date.UTC(2026, 10, 12, 12);
const quiet = { lane: 3, worktree: true, work: null, owner: null, task: null, lastActivityMs: NOW - ACTIVE_MS - 1 };

test("a lane is someone else's while its session runs, a task names it, it changed lately or a process sits in it", () => {
  assert.deepEqual(judge(quiet, { pid: 1 }, { now: NOW }), { mine: false, users: [] });
  const owned = { ...quiet, owner: { pid: 7, name: "fly-island-e9", alive: true } };
  assert.deepEqual(judge(owned, { pid: 1 }, { now: NOW }).users, ["会话 fly-island-e9 在用"]);
  assert.deepEqual(judge({ ...owned, owner: { ...owned.owner, alive: false } }, {}, { now: NOW }).users, []);
  const tasked = { ...quiet, task: { id: "C41.4", owner: "fly-island-e9", status: "待用户确认" } };
  assert.deepEqual(judge(tasked, {}, { now: NOW }).users, ["任务 C41.4（fly-island-e9，待用户确认）"]);
  assert.deepEqual(judge({ ...quiet, lastActivityMs: NOW - 9 * 60000 }, {}, { now: NOW }).users, ["9 分钟前有改动"]);
  let probed = 0;
  const busy = () => (probed += 1) > 0;
  assert.deepEqual(judge(quiet, {}, { now: NOW, busy }).users, ["有进程的当前目录在里面"]);
  judge(owned, {}, { now: NOW, busy });
  assert.equal(probed, 1, "no rename probe once something else says the lane is in use");
});

test("a session's own lane is its own however it is known, but work in it is never handed out", () => {
  const owned = { ...quiet, owner: { pid: 7, name: "a", alive: true }, lastActivityMs: NOW };
  assert.equal(judge(owned, { pid: 7 }, { now: NOW }).mine, true, "same claude.exe");
  assert.equal(judge(owned, { name: "a" }, { now: NOW }).mine, true, "same session name");
  assert.equal(judge(owned, { fromLane: 3 }, { now: NOW }).mine, true, "the session is in it (/clear)");
  assert.equal(judge({ ...quiet, task: { id: "X", owner: "b", status: "进行中" } }, { name: "b" }, { now: NOW }).mine, true, "its task's lane");
  const verdict = judge(owned, { pid: 7 }, { now: NOW });
  assert.equal(usable({ ...owned, work: "2 个未提交的文件" }, verdict), false);
  assert.equal(usable(owned, verdict), true);
  assert.equal(usable(owned, judge(owned, { pid: 8 }, { now: NOW })), false);
});

test("lanes are found from any folder inside them", () => {
  const main = path.join("E:", "Projects", "fly-island");
  assert.equal(lanePath(main, 4), path.join("E:", "Projects", "fly-island-lanes", "4"));
  assert.equal(laneOf(main, path.join(lanePath(main, 21), "src", "x")), 21);
  assert.equal(laneOf(main, main), null);
  assert.equal(laneOf(main, path.join("E:", "Projects", "fly-island-lanes", "_prtools")), null);
});

test("the list says whose a lane is and why", () => {
  const line = listLine({ ...quiet, branch: "lane/3", owner: { pid: 7, name: "a", alive: false }, users: [], lastActivityMs: NOW - 3 * 3600000 }, NOW);
  assert.match(line, /^ {2}3 {2}lane\/3 .*a（已退出）.*3 小时前.*空闲，可复用$/);
  assert.match(listLine({ ...quiet, work: "1 个提交不在 main 上", users: [] }, NOW), /有工作：1 个提交不在 main 上$/);
});

test("lanes are handed back, reused when idle, created when none is, and taken over on purpose", () => {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "lanes-")));
  const main = path.join(root, "app");
  const git = (args, cwd = main) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  // land runs the checks from git's pre-push hook, whose GIT_DIR would point every git call
  // here at the real repo: once that re-initialised it as bare and committed to it.
  const hookEnv = Object.keys(process.env).filter((name) => name.startsWith("GIT_")).map((name) => [name, process.env[name]]);
  for (const [name] of hookEnv) delete process.env[name];
  try {
    mkdirSync(main);
    git(["init", "-q", "-b", "main"]);
    assert.ok(path.resolve(main, git(["rev-parse", "--git-dir"])).startsWith(root + path.sep), "git must run in the temp repo");
    git(["commit", "-q", "--allow-empty", "-m", "one"]);
    const alive = process.pid;
    const later = Date.now() + ACTIVE_MS + 60000;

    const a = openLane({ main, pid: alive, name: "a", install: false });
    assert.deepEqual([a.lane, a.reused], [1, false]);
    const b = openLane({ main, pid: 999999, name: "b", install: false });
    assert.equal(b.lane, 2, "lane 1's session runs, so a second session gets a new lane");
    writeFileSync(path.join(b.wt, "wip.txt"), "x");

    git(["commit", "-q", "--allow-empty", "-m", "two"]); // a land
    const again = openLane({ main, pid: alive, name: "a", install: false });
    assert.deepEqual([again.lane, again.reused], [1, true], "/clear or a new conversation: the same session gets its lane back");
    assert.equal(git(["rev-parse", "HEAD"], again.wt), git(["rev-parse", "HEAD"]), "reset to main");
    assert.equal(openLane({ main, fromCwd: path.join(again.wt, "src"), install: false }).lane, 1, "a session sitting in its lane");

    releaseLane(main, 1);
    const c = openLane({ main, pid: 999998, name: "c", install: false, now: later });
    assert.equal(c.lane, 1, "an idle lane nobody uses goes to the next session");
    assert.equal(git(["status", "--porcelain"], b.wt), "?? wip.txt", "the lane with work is left alone");
    assert.equal(openLane({ main, pid: 999997, install: false }).lane, 3, "lane 1 changed just now, so not yet");

    assert.throws(() => takeLane(main, 1, { pid: alive, name: "d" }), /有人在用：.*分钟前有改动/);
    takeLane(main, 1, { pid: alive, name: "d", force: true });
    assert.equal(ownerOf(main, 1).name, "d");
    const listed = listLanes(main, { name: "d" });
    assert.deepEqual(listed.map((lane) => [lane.lane, lane.mine, Boolean(lane.work)]), [[1, true, false], [2, false, true], [3, false, false]]);
  } finally {
    for (const [name, value] of hookEnv) process.env[name] = value;
    rmSync(root, { recursive: true, force: true });
  }
});

test("the patched merge queue hook hands out lanes through scripts/lanes", () => {
  const hook = path.join(fileURLToPath(new URL("../..", import.meta.url)), "node_modules", "claude-code-merge-queue", "dist", "hooks", "worktree-create.js");
  assert.match(readFileSync(hook, "utf8"), /"scripts", "lanes", "lanePool\.mjs"/);
});
