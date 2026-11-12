import { execFileSync } from "node:child_process";
import { existsSync, renameSync, statSync } from "node:fs";
import path from "node:path";
import { lanePath, ownerOf, pidAlive } from "./laneRegistry.mjs";
import { readAll, staleOf } from "../tasks/taskRepo.mjs";

export const ACTIVE_MS = 2 * 60 * 60 * 1000;
export const UNKNOWN_OWNER_MS = 24 * 60 * 60 * 1000;

function tryGit(args, cwd) {
  try {
    return execFileSync("git", ["--no-optional-locks", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

function mtime(file) {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

export function tasksByLane(main) {
  const byLane = new Map();
  let tasks = [];
  try {
    tasks = readAll(main);
  } catch {
    return byLane;
  }
  for (const task of tasks) {
    const { lane, status, owner } = task.fields;
    if (!lane) continue;
    const holds = status === "待用户确认" || (status === "进行中" && !staleOf(main, task));
    if (holds) byLane.set(Number(lane), { id: task.fields.id, owner, status });
  }
  return byLane;
}

export function laneFacts(main, lane, { mainHead, owners, tasks }) {
  const wt = lanePath(main, lane);
  const facts = { lane, wt, exists: existsSync(wt), worktree: existsSync(path.join(wt, ".git")) };
  if (!facts.worktree) return { ...facts, work: facts.exists ? "不是 worktree" : null };
  const branch = tryGit(["rev-parse", "--abbrev-ref", "HEAD"], wt);
  const status = tryGit(["status", "--porcelain", "--untracked-files=all"], wt);
  const onMain = tryGit(["merge-base", "--is-ancestor", "HEAD", mainHead], wt) !== null;
  const unlanded = onMain ? 0 : Number(tryGit(["rev-list", "--count", `${mainHead}..HEAD`], wt) ?? 1);
  const dirty = status === null ? null : status.split("\n").filter(Boolean).length;
  const gitDir = tryGit(["rev-parse", "--absolute-git-dir"], wt);
  const owner = ownerOf(main, lane, owners);
  const seen = Date.parse(owner?.seen ?? "") || 0;
  const lastActivityMs = Math.max(seen, ...(gitDir ? ["index", "HEAD", path.join("logs", "HEAD")].map((file) => mtime(path.join(gitDir, file))) : [0]));
  let work = null;
  if (dirty === null) work = "git status 失败";
  else if (dirty) work = `${dirty} 个未提交的文件`;
  else if (unlanded) work = `${unlanded} 个提交不在 main 上`;
  return {
    ...facts,
    branch,
    work,
    owner: owner ? { pid: owner.pid ?? null, name: owner.name ?? null, alive: owner.pid ? pidAlive(owner.pid) : null, seenMs: seen } : null,
    task: tasks.get(lane) ?? null,
    lastActivityMs,
  };
}

export function folderBusy(wt) {
  if (process.platform !== "win32") return false;
  const probe = `${wt}.probe-${process.pid}`;
  try {
    renameSync(wt, probe);
  } catch {
    return true;
  }
  renameSync(probe, wt);
  return false;
}

export function judge(facts, requester = {}, { now = Date.now(), busy = () => false } = {}) {
  const { owner, task } = facts;
  const mine = facts.lane === requester.fromLane
    || Boolean(requester.pid && owner?.pid === requester.pid)
    || Boolean(requester.name && (owner?.name === requester.name || task?.owner === requester.name));
  if (mine) return { mine, users: [] };
  const users = [];
  if (owner?.alive) users.push(`会话 ${owner.name ?? `pid ${owner.pid}`} 在用`);
  else if (owner && owner.alive === null && now - (owner.seenMs ?? 0) < UNKNOWN_OWNER_MS) {
    users.push(`会话 ${owner.name ?? "（无名）"} ${Math.max(0, Math.round((now - owner.seenMs) / 3600000))} 小时前登记（进程未知）`);
  }
  if (task) users.push(`任务 ${task.id}（${task.owner ?? "无人"}，${task.status}）`);
  const quiet = now - (facts.lastActivityMs ?? 0);
  if (quiet < ACTIVE_MS) users.push(`${Math.max(0, Math.round(quiet / 60000))} 分钟前有改动`);
  if (!users.length && busy()) users.push("有进程的当前目录在里面");
  return { mine, users };
}

export function usable(facts, verdict) {
  return facts.worktree && !facts.work && (verdict.mine || verdict.users.length === 0);
}
