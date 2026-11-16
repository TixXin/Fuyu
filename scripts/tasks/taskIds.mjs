import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isTaskId } from "./taskFile.mjs";
import { ghJson } from "./taskIssues.mjs";
import { TASKS_DIR, readEntries } from "./taskRepo.mjs";

const exec = promisify(execFile);
const GIT_TIMEOUT_MS = 30_000;
export const OPEN_ISSUE_LIMIT = 1000;
export const CLOSED_ISSUE_LIMIT = 200;
const TITLE_ID = /\[([A-Z][0-9]+[a-z]?(?:\.[0-9]+)*)\]/g;

export async function runGit(root, args) {
  const { stdout } = await exec("git", ["-C", root, ...args], {
    encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: GIT_TIMEOUT_MS, windowsHide: true,
  });
  return stdout;
}

function reason(error) {
  if (error?.killed) return "超时";
  if (error?.code === "ENOENT") return "找不到命令";
  return `${error?.stderr || error?.message || error}`.split("\n").map((line) => line.trim()).find(Boolean) ?? "原因不明";
}

function lines(text) {
  return String(text ?? "").replace(/\r/g, "").split("\n").map((line) => line.trim()).filter(Boolean);
}

export function idsInPaths(text) {
  return lines(text)
    .map((file) => new RegExp(`^${TASKS_DIR}/(?:.+/)?([^/]+)\\.md$`).exec(file)?.[1])
    .filter((id) => id && isTaskId(id));
}

export function idsInTitles(issues, skipIssue) {
  const found = [];
  for (const { number, title } of issues) {
    if (number === skipIssue) continue;
    for (const match of String(title ?? "").matchAll(TITLE_ID)) found.push({ id: match[1], where: `#${number}` });
  }
  return found;
}

export async function usedIds(root, { git = runGit, gh = ghJson, warn = console.warn, skipIssue } = {}) {
  const used = new Map();
  const note = (ids, where) => {
    for (const id of ids) if (!used.has(id)) used.set(id, where);
  };
  note(readEntries(root).map((entry) => entry.id).filter(isTaskId), "本地");
  try {
    await git(root, ["fetch", "-q", "--prune", "origin"]);
  } catch (error) {
    warn(`[tasks] git fetch 失败（${reason(error)}），远端分支按上次取到的算`);
  }
  let refs = [];
  try {
    refs = lines(await git(root, ["for-each-ref", "--format=%(refname:short)", "refs/remotes/origin/main", "refs/remotes/origin/land/"]));
  } catch (error) {
    warn(`[tasks] 列不出远端分支（${reason(error)}），只算本地的任务文件`);
  }
  for (const ref of refs) {
    try {
      note(idsInPaths(await git(root, ["ls-tree", "-r", "--name-only", ref, TASKS_DIR])), ref);
    } catch (error) {
      warn(`[tasks] 读不了 ${ref} 上的任务（${reason(error)}）`);
    }
  }
  try {
    const list = (state, limit) => gh(["issue", "list", "--state", state, "--limit", String(limit), "--json", "number,title"]);
    const [open, closed] = await Promise.all([list("open", OPEN_ISSUE_LIMIT), list("closed", CLOSED_ISSUE_LIMIT)]);
    for (const { id, where } of idsInTitles([...open, ...closed], skipIssue)) note([id], where);
  } catch (error) {
    warn(`[tasks] 读不到 GitHub issue（${reason(error)}），另一台机器还没推的任务看不到`);
  }
  return used;
}

function largest(ids, pattern) {
  let max = 0;
  for (const id of ids) {
    const number = Number(pattern.exec(id)?.[1] ?? 0);
    if (number > max) max = number;
  }
  return max;
}

export function nextId(prefix, used) {
  const ids = [...used.keys()];
  if (/^[A-Z]$/.test(prefix)) return `${prefix}${largest(ids, new RegExp(`^${prefix}([0-9]+)`)) + 1}`;
  const parent = prefix.replaceAll(".", "\\.");
  return `${prefix}.${largest(ids, new RegExp(`^${parent}\\.([0-9]+)(?:\\.|$)`)) + 1}`;
}
