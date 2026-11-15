import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";
import { claimText, filesInScope, splitList } from "./taskFile.mjs";

export const HOT_FILES = [
  "AGENTS.md",
  "package.json",
  "pnpm-lock.yaml",
  "docs/architecture/platforms.md",
  "docs/architecture/contracts.md",
  "docs/architecture/data-storage.md",
  "docs/architecture/overview.md",
  "docs/architecture/workflow.md",
  "src-tauri/Cargo.toml",
  "src-tauri/Cargo.lock",
  "src-tauri/src/lib.rs",
  "src-tauri/capabilities/",
  "src/windows/settings/searchIndex.json",
  "src/i18n/types.ts",
  "scripts/file-size-allowlist.json",
  "scripts/color-literal-allowlist.json",
];

export const QUIET_HOURS = 3;
const TASK_FILE = /^docs\/tasks\/(?:0-archive\/)?[A-Z]\/([A-Z][0-9][^/]*)\.md$/;

export function parseStatus(text) {
  const entries = [];
  const parts = text.split("\0");
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part.length < 4) continue;
    const index = part[0];
    entries.push({ file: part.slice(3), staged: index !== " " && index !== "?", untracked: index === "?" });
    if (index === "R" || index === "C") i += 1;
  }
  return entries;
}

function isHot(file) {
  return HOT_FILES.some((hot) => hot === file || (hot.endsWith("/") && file.startsWith(hot)));
}

export function dirtyReport(entries, tasks, { now = Date.now(), quietHours = QUIET_HOURS } = {}) {
  const open = tasks.filter((task) => task.fields.status === "进行中" && task.fields.owner);
  const byTask = new Map(open.map((task) => [task.fields.id, []]));
  const unowned = [];
  for (const entry of entries) {
    const own = TASK_FILE.exec(entry.file)?.[1];
    const owners = open.filter((task) => task.fields.id === own || filesInScope([entry.file], splitList(task.fields.scope)).length);
    for (const task of owners) byTask.get(task.fields.id).push(entry);
    if (!owners.length) unowned.push(entry);
  }
  const quietMs = quietHours * 3600 * 1000;
  return {
    total: entries.length,
    tasks: open.filter((task) => byTask.get(task.fields.id).length).map((task) => ({ task, files: byTask.get(task.fields.id) })),
    unowned,
    quiet: entries.filter((entry) => entry.mtimeMs && now - entry.mtimeMs > quietMs),
    hot: entries.filter((entry) => isHot(entry.file)),
    staged: entries.filter((entry) => entry.staged),
    quietHours,
  };
}

function hoursAgo(ms, now) {
  return `${Math.max(0, Math.round((now - ms) / 3600000))} 小时`;
}

export function dirtyLines(report, { now = Date.now() } = {}) {
  if (!report.total) return ["工作区里没有没提交的文件。"];
  const lines = [`工作区里有 ${report.total} 个没提交的文件。`];
  const list = (entries) => entries.map((entry) => `    ${entry.file}${entry.mtimeMs ? `（${hoursAgo(entry.mtimeMs, now)}前改的）` : ""}`);
  if (report.hot.length) {
    lines.push("", `热点文件 ${report.hot.length} 个：大家都会改，挂着会挡住本地 main 跟上 origin/main，改完就单独提交：`, ...list(report.hot));
  }
  if (report.unowned.length) {
    lines.push("", `不在任何进行中任务的认领范围里 ${report.unowned.length} 个：可能是会话停下后留下的，或者认领时 --scope 没写全：`, ...list(report.unowned));
  }
  if (report.quiet.length) {
    lines.push("", `超过 ${report.quietHours} 小时没动的 ${report.quiet.length} 个：确认它的会话还在做，做完的提交、做不完的 tasks note 留交接：`, ...list(report.quiet));
  }
  if (report.staged.length) {
    lines.push("", `暂存区里有 ${report.staged.length} 个文件：暂存区是共用的，提交时只用 git commit -- <文件>，别人不带文件名的提交会把它们带走：`, ...list(report.staged));
  }
  if (report.tasks.length) {
    lines.push("", "按任务：");
    for (const { task, files } of report.tasks) lines.push(`  ${task.fields.id}  ${claimText(task.fields)}：${files.length} 个`);
  }
  return lines;
}

export function readDirty(root) {
  const out = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return parseStatus(out).map((entry) => {
    try {
      return { ...entry, mtimeMs: statSync(path.join(root, entry.file)).mtimeMs };
    } catch {
      return { ...entry, mtimeMs: null };
    }
  });
}
