// Handing out lanes, so there are about as many as sessions at once instead of
// one more per session, /clear or restart. The WorktreeCreate hook (through the
// patched merge queue) and `pnpm lane:open` both come here:
//   1. the requester's own idle lane (the one it is in, or recorded as its);
//   2. otherwise the lowest-numbered lane nobody uses (laneState.mjs);
//   3. otherwise a new lane at the lowest free number.
// A lane handed out is reset to the main checkout's HEAD; it keeps its
// node_modules and build caches. Lanes with work in them are never reset.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { BRANCH_PREFIX, MAX_LANE, commonDir, forgetOwner, lanePath, laneOf, readOwners, recordOwner } from "./laneRegistry.mjs";
import { folderBusy, judge, laneFacts, tasksByLane, usable } from "./laneState.mjs";

const LOCK_STALE_MS = 60 * 1000;

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function tryGit(args, cwd) {
  try {
    return git(args, cwd);
  } catch {
    return null;
  }
}

/** Runs `work` while no other session hands out lanes. */
export function withPoolLock(main, work) {
  const lock = path.join(commonDir(main), "claude-code-merge-queue", "lane-pool.lock");
  mkdirSync(path.dirname(lock), { recursive: true });
  for (let tries = 0; ; tries += 1) {
    try {
      mkdirSync(lock);
      break;
    } catch {
      let age = 0;
      try {
        age = Date.now() - statSync(lock).mtimeMs;
      } catch {
        continue;
      }
      if (age > LOCK_STALE_MS || tries > 300) rmSync(lock, { recursive: true, force: true });
      else Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
  try {
    return work();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

function existingLanes(main) {
  const lanes = [];
  for (let lane = 1; lane <= MAX_LANE; lane += 1) if (existsSync(lanePath(main, lane))) lanes.push(lane);
  return lanes;
}

/** Every lane folder with its facts and, for `requester`, whose it is. */
export function listLanes(main, requester = {}, { now = Date.now(), probe = true } = {}) {
  const context = { mainHead: git(["rev-parse", "HEAD"], main), owners: readOwners(main), tasks: tasksByLane(main) };
  return existingLanes(main).map((lane) => {
    const facts = laneFacts(main, lane, context);
    const verdict = judge(facts, requester, { now, busy: () => probe && facts.worktree && folderBusy(facts.wt) });
    return { ...facts, ...verdict, usable: usable(facts, verdict) };
  });
}

function createLane(main, mainHead) {
  tryGit(["worktree", "prune"], main);
  for (let lane = 1; lane <= MAX_LANE; lane += 1) {
    const wt = lanePath(main, lane);
    if (existsSync(wt)) continue;
    const branch = `${BRANCH_PREFIX}${lane}`;
    const hasBranch = tryGit(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], main) !== null;
    // An old lane/N branch is reused only when it has nothing main lacks; otherwise the number is skipped.
    if (hasBranch && tryGit(["merge-base", "--is-ancestor", branch, mainHead], main) === null) continue;
    const args = hasBranch ? ["worktree", "add", "-q", "-f", wt, branch] : ["worktree", "add", "-q", wt, "-b", branch, mainHead];
    if (tryGit(args, main) === null) continue;
    if (hasBranch) git(["checkout", "-q", "-B", branch, mainHead], wt);
    return { lane, wt, branch, reused: false };
  }
  throw new Error(`no free lane number up to ${MAX_LANE}`);
}

/**
 * Picks a lane for the session `{ pid, name }` started from `fromCwd`, records it as theirs and
 * returns `{ lane, wt, branch, reused }`. `install` runs the package manager in it afterwards.
 */
export function openLane({ main, fromCwd = null, pid = null, name = null, install = true, now = Date.now() }) {
  const picked = withPoolLock(main, () => {
    const mainHead = git(["rev-parse", "HEAD"], main);
    const requester = { pid, name, fromLane: laneOf(main, fromCwd) };
    const lanes = listLanes(main, requester, { now, probe: false });
    const order = [...lanes.filter((lane) => lane.mine && lane.lane === requester.fromLane), ...lanes.filter((lane) => lane.mine), ...lanes];
    for (const lane of order) {
      if (!usable(lane, lane)) continue;
      if (!lane.mine && folderBusy(lane.wt)) continue;
      const branch = `${BRANCH_PREFIX}${lane.lane}`;
      if (tryGit(["checkout", "-q", "-B", branch, mainHead], lane.wt) === null) continue;
      recordOwner(main, lane.lane, { pid, name });
      return { lane: lane.lane, wt: lane.wt, branch, reused: true };
    }
    const created = createLane(main, mainHead);
    recordOwner(main, created.lane, { pid, name });
    return created;
  });
  if (install) {
    try {
      execFileSync("pnpm", ["install", "--prefer-offline"], { cwd: picked.wt, shell: process.platform === "win32", stdio: ["ignore", "pipe", "pipe"] });
    } catch {
      process.stderr.write(`[lanes] pnpm install failed in ${picked.wt}; run it there by hand\n`);
    }
  }
  return picked;
}

/** Records lane `lane` as `{ pid, name }`'s, for a session taking it over; refuses while someone else uses it unless `force`. */
export function takeLane(main, lane, { pid = null, name = null, force = false, now = Date.now() }) {
  return withPoolLock(main, () => {
    const entry = listLanes(main, { pid, name }, { now }).find((item) => item.lane === lane);
    if (!entry?.worktree) throw new Error(`lane ${lane} 不存在或不是 worktree`);
    if (entry.users.length && !force) throw new Error(`lane ${lane} 有人在用：${entry.users.join("；")}。确认对方已经不用了再加 --force`);
    recordOwner(main, lane, { pid, name });
    return entry;
  });
}

export function releaseLane(main, lane) {
  forgetOwner(main, lane);
}
