import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { REPO, tasksByIssue } from "../issues/issueFormat.mjs";
import { CLOSED_STATUSES, compareIds, parseTask } from "./taskFile.mjs";
import { ARCHIVE_DIR, readAll, taskPath, tryGit } from "./taskRepo.mjs";

const exec = promisify(execFile);
const GH_TIMEOUT_MS = 20_000;
const REASON_WIDTH = 80;

export async function ghJson(args) {
  const { stdout } = await exec("gh", [...args, "--repo", REPO], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: GH_TIMEOUT_MS, windowsHide: true });
  return JSON.parse(stdout);
}

export function failReason(error) {
  if (error?.code === "ENOENT") return "没有装 gh";
  if (error?.killed) return "gh 超时";
  const lines = `${error?.stderr || error?.message || error}`.split("\n").map((line) => line.trim()).filter(Boolean);
  return (lines[0] ?? "原因不明").slice(0, REASON_WIDTH);
}

export async function openIssueNumbers(run = ghJson) {
  const issues = await run(["issue", "list", "--state", "open", "--limit", "1000", "--json", "number"]);
  return issues.map((issue) => issue.number);
}

export function issuesToClose(tasks, openNumbers) {
  const open = new Set(openNumbers);
  const rows = [];
  for (const [issue, linked] of tasksByIssue(tasks)) {
    if (!open.has(issue)) continue;
    const done = linked.filter((task) => task.fields.status === "已完成");
    if (!done.length || linked.some((task) => !CLOSED_STATUSES.includes(task.fields.status))) continue;
    rows.push({ issue, ids: done.map((task) => task.fields.id).sort(compareIds), title: done[0].fields.title });
  }
  return rows.sort((a, b) => a.issue - b.issue);
}

export function doneAt(root, rev, id) {
  const text = tryGit(["show", `${rev}:${taskPath(id, true)}`], root);
  if (text === null) return false;
  try {
    return parseTask(text).fields.status === "已完成";
  } catch {
    return false;
  }
}

export function landedOnMain(root, id) {
  return doneAt(root, "origin/main", id);
}

export function closeReminder({ id, issue }) {
  return issue ? `${id} 对应 #${issue}：合入 main 后回复完成情况并关闭（docs/tasks/README.md「GitHub issue」）；pnpm progress 会列出已完成而没关的` : null;
}

export function doneIdsInMerge(root, oid) {
  if (!oid) return [];
  const out = tryGit(["diff", "--no-renames", "--diff-filter=A", "--name-only", `${oid}^1`, oid, "--", ARCHIVE_DIR], root);
  return (out ?? "").split("\n").map((file) => /\/([^/]+)\.md$/.exec(file.trim())?.[1]).filter(Boolean);
}

function doneWithIssue(tasks, ids) {
  const batch = new Set(ids);
  return tasks.filter((task) => batch.has(task.fields.id) && task.fields.status === "已完成" && task.fields.issue);
}

export function mergedReminderLines(tasks, ids, open) {
  const batch = new Set(ids);
  const linked = doneWithIssue(tasks, ids);
  if (!linked.length) return [];
  if (open.error) {
    const list = linked.map((task) => `#${task.fields.issue}（${task.fields.id}）`).join("、");
    return [`取不到 issue 的状态（${open.error}）。这一批完成的任务带着这些 issue，确认都回复并关闭了：${list}`];
  }
  const rows = issuesToClose(tasks, open.numbers).filter((row) => row.ids.some((id) => batch.has(id)));
  if (!rows.length) return [];
  return [
    `这一批里完成的任务还有 ${rows.length} 个 issue 开着，回复完成情况后关闭（docs/tasks/README.md「GitHub issue」）：`,
    ...rows.map((row) => `  #${row.issue}  ${row.ids.join("、")}  ${row.title}`),
  ];
}

export async function mergedReminder(root, oid, { openIssues = openIssueNumbers } = {}) {
  try {
    const ids = doneIdsInMerge(root, oid);
    if (!ids.length) return [];
    const tasks = readAll(root);
    if (!doneWithIssue(tasks, ids).length) return [];
    let open;
    try {
      open = { numbers: await openIssues() };
    } catch (error) {
      open = { error: failReason(error) };
    }
    return mergedReminderLines(tasks, ids, open);
  } catch {
    return [];
  }
}
