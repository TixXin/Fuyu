import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { currentSession, laneOf, lanePath, ownerKey, ownerOf, sessionAlive } from "../../scripts/lanes/laneRegistry.mjs";
import { ACTIVE_MS, UNKNOWN_OWNER_MS, judge, ownerAlive, usable } from "../../scripts/lanes/laneState.mjs";
import { finishLane, listLanes, openLane, takeLane } from "../../scripts/lanes/lanePool.mjs";
import { doneLines, listLine } from "../../scripts/lanes/lanes.mjs";
import { laneOfKey, lanesToFinish } from "../../scripts/lanes/session-end.mjs";
import { hintFor } from "../../scripts/lanes/session-hint.mjs";

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
  const unknown = { ...quiet, owner: { pid: null, name: "fly-island-4b", alive: null, seenMs: NOW - 1 * 3600000 } };
  assert.deepEqual(judge(unknown, {}, { now: NOW }).users, ["会话 fly-island-4b 1 小时前登记（进程未知）"], "an old record with neither session nor pid");
  assert.deepEqual(judge({ ...unknown, owner: { ...unknown.owner, seenMs: NOW - UNKNOWN_OWNER_MS - 1 } }, {}, { now: NOW }).users, []);
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

test("a session starting in the main checkout is told to open a lane first, one in a lane is not", () => {
  const main = path.join("E:", "Projects", "fly-island");
  assert.match(hintFor(main, main), /lane:open/);
  assert.match(hintFor(main, path.join(main, "src")), /EnterWorktree/);
  assert.equal(hintFor(main, path.join(lanePath(main, 4), "src")), null);
  assert.equal(hintFor(main, path.join("E:", "Projects", "other")), null);
});

test("changes made before a lane was released do not keep it in use", () => {
  const recent = { ...quiet, lastActivityMs: NOW - 5 * 60000 };
  assert.deepEqual(judge(recent, {}, { now: NOW }).users, ["5 分钟前有改动"]);
  assert.deepEqual(judge({ ...recent, releasedMs: NOW - 60000 }, {}, { now: NOW }).users, []);
  assert.deepEqual(judge({ ...recent, releasedMs: NOW - 10 * 60000 }, {}, { now: NOW }).users, ["5 分钟前有改动"], "changed again after the release");
});

test("leaving a session releases the lane it is in and the lanes its claude.exe recorded, but not on /clear", () => {
  const main = path.join("E:", "Projects", "fly-island");
  const key = (n) => path.resolve(lanePath(main, n)).toLowerCase();
  const owners = { [key(2)]: { pid: 7 }, [key(3)]: { pid: 8 }, [key(5)]: { pid: 7 } };
  assert.deepEqual(lanesToFinish({ main, cwd: path.join(lanePath(main, 4), "src"), reason: "prompt_input_exit", pid: 7, owners }), [2, 4, 5]);
  assert.deepEqual(lanesToFinish({ main, cwd: main, reason: "other", pid: null, owners }), []);
  assert.deepEqual(lanesToFinish({ main, cwd: lanePath(main, 4), reason: "clear", pid: 7, owners }), []);
  assert.deepEqual(lanesToFinish({ main, cwd: lanePath(main, 4), reason: "resume", pid: 7, owners }), []);
  const bySession = { [key(2)]: { pid: 7, session: "s-a" }, [key(3)]: { pid: 7, session: "s-b" }, [key(6)]: { pid: null, session: "s-a" } };
  assert.deepEqual(lanesToFinish({ main, cwd: path.join("C:", "Temp", "magpie"), reason: "other", session: "s-a", pid: 7, owners: bySession }), [2, 6], "a magpie session started elsewhere still releases its lanes, by session id");
});

test("owner records are keyed by the lowercased path, and still map back to lanes of a mixed-case checkout (macOS)", () => {
  const main = path.join("E:", "Projects", "Fuyu");
  assert.equal(laneOfKey(main, ownerKey(lanePath(main, 2))), 2);
  assert.equal(laneOfKey(main, ownerKey(path.join("E:", "Projects", "Other-lanes", "2"))), null);
  assert.equal(laneOfKey(main, ownerKey(path.join(lanePath(main, 2), "src"))), null);
  const owners = { [ownerKey(lanePath(main, 2))]: { pid: null, session: "s-mac" } };
  assert.deepEqual(lanesToFinish({ main, cwd: main, reason: "prompt_input_exit", session: "s-mac", owners }), [2]);
});

test("a session that exits inside a lane someone else recorded leaves that lane alone", () => {
  const main = path.join("E:", "Projects", "fuyu");
  const key = (n) => path.resolve(lanePath(main, n)).toLowerCase();
  const owners = { [key(1)]: { pid: null, name: "fuyu-b7", session: "s-owner" }, [key(3)]: { pid: 8 }, [key(4)]: { pid: null, name: "old" } };
  assert.deepEqual(lanesToFinish({ main, cwd: lanePath(main, 1), reason: "other", session: "s-child", pid: 9, owners }), [], "a headless claude -p started in the lane");
  assert.deepEqual(lanesToFinish({ main, cwd: lanePath(main, 3), reason: "other", session: "s-child", pid: 9, owners }), []);
  assert.deepEqual(lanesToFinish({ main, cwd: lanePath(main, 4), reason: "other", session: "s-child", pid: 9, owners }), [], "a record without session or pid may be anyone's");
  assert.deepEqual(lanesToFinish({ main, cwd: lanePath(main, 1), reason: "other", session: "s-owner", pid: null, owners }), [1]);
  assert.deepEqual(lanesToFinish({ main, cwd: lanePath(main, 3), reason: "other", session: null, pid: 8, owners }), [3]);
});

test("a session is alive while ~/.claude/sessions lists it with a running process", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "claude-sessions-"));
  try {
    writeFileSync(path.join(dir, `${process.pid}.json`), JSON.stringify({ pid: process.pid, sessionId: "live", name: "fly-island-c5" }));
    writeFileSync(path.join(dir, "999999.json"), JSON.stringify({ pid: 999999, sessionId: "gone", name: "x" }));
    assert.equal(sessionAlive("live", dir), true);
    assert.equal(sessionAlive("gone", dir), false);
    assert.equal(sessionAlive("never", dir), false);
    assert.equal(ownerAlive({ session: "gone", pid: process.pid }, dir), false, "the session id wins over a pid that may be reused");
    assert.equal(ownerAlive({ pid: null }, dir), null);
    assert.deepEqual(currentSession({ CLAUDE_CODE_SESSION_ID: "live" }, dir), { session: "live", pid: process.pid, name: "fly-island-c5" });
    assert.deepEqual(currentSession({ CLAUDE_PID: String(process.pid) }, dir), { session: "live", pid: process.pid, name: "fly-island-c5" });
    assert.deepEqual(currentSession({}, dir), { session: null, pid: null, name: null });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("lane:done says what still keeps the lane", () => {
  assert.match(doneLines({ lane: 3, released: true })[0], /已释放。可以退出会话/);
  const kept = doneLines({ lane: 3, released: false, problems: ["2 个未提交的文件"], files: [" M a.ts"], task: { id: "C1", status: "进行中" } });
  assert.match(kept[0], /还不能释放：2 个未提交的文件/);
  assert.equal(kept[1], "     M a.ts");
  assert.match(kept[2], /任务 C1/);
});

test("the list says whose a lane is and why", () => {
  const line = listLine({ ...quiet, branch: "lane/3", owner: { pid: 7, name: "a", alive: false }, users: [], lastActivityMs: NOW - 3 * 3600000 }, NOW);
  assert.match(line, /^ {2}3 {2}lane\/3 .*a（已退出）.*3 小时前.*空闲，可复用$/);
  assert.match(listLine({ ...quiet, work: "1 个提交不在 main 上", users: [] }, NOW), /有工作：1 个提交不在 main 上$/);
  assert.match(listLine({ ...quiet, mine: true, users: [], owner: { pid: null, name: "b", alive: null } }, NOW), /b（进程未知）.* 你的 lane$/);
});

test("lanes are handed back, reused when idle, created when none is, and taken over on purpose", () => {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "lanes-")));
  const main = path.join(root, "app");
  const git = (args, cwd = main) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const hookEnv = Object.keys(process.env).filter((name) => name.startsWith("GIT_")).map((name) => [name, process.env[name]]);
  for (const [name] of hookEnv) delete process.env[name];
  try {
    mkdirSync(main);
    git(["init", "-q", "-b", "main"]);
    assert.ok(path.resolve(main, git(["rev-parse", "--git-dir"])).startsWith(root + path.sep), "git must run in the temp repo");
    git(["commit", "-q", "--allow-empty", "-m", "one"]);
    const alive = process.pid;

    const a = openLane({ main, pid: alive, name: "a", install: false });
    assert.deepEqual([a.lane, a.reused], [1, false]);
    const b = openLane({ main, pid: 999999, name: "b", install: false });
    assert.equal(b.lane, 2, "lane 1's session runs, so a second session gets a new lane");
    writeFileSync(path.join(b.wt, "wip.txt"), "x");

    git(["commit", "-q", "--allow-empty", "-m", "two"]);
    const again = openLane({ main, pid: alive, name: "a", install: false });
    assert.deepEqual([again.lane, again.reused], [1, true], "/clear or a new conversation: the same session gets its lane back");
    assert.equal(git(["rev-parse", "HEAD"], again.wt), git(["rev-parse", "HEAD"]), "reset to main");
    assert.equal(openLane({ main, fromCwd: path.join(again.wt, "src"), install: false }).lane, 1, "a session sitting in its lane");

    const refused = finishLane(main, 2);
    assert.deepEqual([refused.released, refused.files], [false, ["?? wip.txt"]], "lane:done keeps a lane with work");
    assert.equal(ownerOf(main, 2).name, "b");
    assert.equal(finishLane(main, 1).released, true, "lane:done releases a clean, landed lane");
    const c = openLane({ main, pid: 999998, name: "c", install: false });
    assert.equal(c.lane, 1, "a released lane goes to the next session at once, changed a moment ago or not");
    assert.equal(git(["status", "--porcelain"], b.wt), "?? wip.txt", "the lane with work is left alone");
    assert.equal(openLane({ main, pid: 999997, install: false }).lane, 3, "lane 1 changed just now, so not yet");

    assert.throws(() => takeLane(main, 1, { pid: alive, name: "d" }), /有人在用：.*分钟前有改动/);
    takeLane(main, 1, { pid: alive, name: "d", force: true });
    assert.equal(ownerOf(main, 1).name, "d");
    takeLane(main, 3, { pid: null, name: "magpie", force: true });
    const queue = JSON.parse(readFileSync(path.join(main, ".git", "claude-code-merge-queue", "lane-owners.json"), "utf8"));
    assert.equal(queue[path.resolve(lanePath(main, 3)).toLowerCase()], undefined);
    assert.equal(queue[path.resolve(lanePath(main, 1)).toLowerCase()]?.pid, alive, "a known pid still goes there");
    assert.deepEqual([ownerOf(main, 3).name, ownerOf(main, 3).pid], ["magpie", null]);
    const listed = listLanes(main, { name: "d" });
    assert.deepEqual(listed.map((lane) => [lane.lane, lane.mine, Boolean(lane.work)]), [[1, true, false], [2, false, true], [3, false, false]]);
  } finally {
    for (const [name, value] of hookEnv) process.env[name] = value;
    rmSync(root, { recursive: true, force: true });
  }
});
