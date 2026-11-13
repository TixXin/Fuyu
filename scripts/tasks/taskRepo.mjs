import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import path from "node:path";
import { CLOSED_STATUSES, formatTask, groupOf, parseTask } from "./taskFile.mjs";
import { checkEntries, parseGroups } from "./taskRules.mjs";

export const TASKS_DIR = "docs/tasks";
export const ARCHIVE_DIR = "docs/tasks/0-archive";
const README = "docs/tasks/README.md";

export function taskPath(id, closed) {
  return `${closed ? ARCHIVE_DIR : TASKS_DIR}/${groupOf(id)}/${id}.md`;
}
const STALE_MS = 24 * 60 * 60 * 1000;

export function git(args, options = {}) {
  return execFileSync("git", args, { encoding: "utf8", ...options }).trim();
}

export function tryGit(args, cwd) {
  try {
    return git(args, { stdio: ["ignore", "pipe", "ignore"], ...(cwd ? { cwd } : {}) });
  } catch {
    return null;
  }
}

function readFiles(root, dir, archived, folder) {
  const full = path.join(root, dir);
  return readdirSync(full)
    .filter((name) => name.endsWith(".md") && !(folder === "" && name === "README.md"))
    .map((name) => {
      const file = `${dir}/${name}`;
      const id = name.slice(0, -3);
      try {
        return { file, id, archived, folder, task: parseTask(readFileSync(path.join(root, file), "utf8")) };
      } catch (error) {
        return { file, id, archived, folder, error: error.message };
      }
    });
}

function readDir(root, dir, archived) {
  if (!existsSync(path.join(root, dir))) return [];
  const folders = readdirSync(path.join(root, dir))
    .filter((name) => name !== path.basename(ARCHIVE_DIR) && statSync(path.join(root, dir, name)).isDirectory());
  return [readFiles(root, dir, archived, ""), ...folders.map((folder) => readFiles(root, `${dir}/${folder}`, archived, folder))].flat();
}

export function readEntries(root) {
  return [...readDir(root, TASKS_DIR, false), ...readDir(root, ARCHIVE_DIR, true)];
}

export function readAll(root) {
  return readEntries(root).filter((entry) => entry.task).map((entry) => entry.task);
}

export function readGroups(root) {
  const file = path.join(root, README);
  return existsSync(file) ? parseGroups(readFileSync(file, "utf8")) : [];
}

export function checkTasks(root) {
  return checkEntries(readEntries(root), readGroups(root));
}

export function findTask(root, id) {
  for (const closed of [false, true]) {
    const file = path.join(root, taskPath(id, closed));
    if (existsSync(file)) return file;
  }
  return null;
}

export function load(root, id) {
  const file = findTask(root, id);
  if (!file) throw new Error(`没有任务 ${id}；新任务先用 pnpm tasks add`);
  return parseTask(readFileSync(file, "utf8"));
}

export function save(root, task) {
  const target = path.join(root, taskPath(task.fields.id, CLOSED_STATUSES.includes(task.fields.status)));
  const current = findTask(root, task.fields.id);
  mkdirSync(path.dirname(target), { recursive: true });
  if (current && path.resolve(current) !== path.resolve(target)) {
    const relative = path.relative(root, current).replaceAll("\\", "/");
    if (tryGit(["-C", root, "ls-files", "--error-unmatch", relative]) !== null) {
      git(["-C", root, "mv", relative, path.relative(root, target).replaceAll("\\", "/")]);
    } else {
      renameSync(current, target);
    }
  }
  writeFileSync(target, formatTask(task));
  return path.relative(root, target).replaceAll("\\", "/");
}


export function nowText(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function todayText(date = new Date()) {
  return nowText(date).slice(0, 10);
}

export function staleReason({ fields }, { lastActivityMs = null, now = Date.now() } = {}) {
  if (fields.status !== "进行中" || !fields.owner) return null;
  const claimedAt = Date.parse(fields.claimed?.replace(" ", "T") ?? "");
  const quietSince = Math.max(Number.isNaN(claimedAt) ? 0 : claimedAt, lastActivityMs ?? 0);
  return quietSince && now - quietSince > STALE_MS ? "认领后超过 24 小时没有动静（任务文件没有新的交接或提交）" : null;
}

function lastActivityMs(root, id) {
  const file = taskPath(id, false);
  const times = ["origin/main", "HEAD"].map((ref) => Number(tryGit(["log", "-1", "--format=%ct", ref, "--", file], root) ?? 0) * 1000);
  return Math.max(...times) || null;
}

export function staleOf(root, task) {
  return task.fields.status === "进行中" ? staleReason(task, { lastActivityMs: lastActivityMs(root, task.fields.id) }) : null;
}

export function taskOnMain(root, id) {
  const text = tryGit(["show", `origin/main:${taskPath(id, false)}`], root);
  if (text === null) return null;
  try {
    return parseTask(text);
  } catch {
    return null;
  }
}

export function machineName(name = hostname()) {
  return name.split(".")[0].toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "host";
}