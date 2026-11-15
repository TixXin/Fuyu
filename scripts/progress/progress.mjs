#!/usr/bin/env node
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readDirty } from "../tasks/taskDirty.mjs";
import { doneAt, failReason, ghJson, issuesToClose, landedOnMain, openIssueNumbers } from "../tasks/taskIssues.mjs";
import { git, readAll, staleOf, staleReason, tryGit } from "../tasks/taskRepo.mjs";
import { progressLines, summarize } from "./report.mjs";

const PR_FIELDS = "number,title,url,headRefName,headRefOid,isDraft,autoMergeRequest,mergeStateStatus,author,statusCheckRollup";

const HELP = [
  "用法：pnpm progress [--no-github] [--json]",
  "",
  "一屏的进度汇总：进行中的任务、没提交的文件、没推的提交、开着的 PR、任务已完成而 issue 还开着的。只读。",
  "  --no-github   不联网：不取 origin/main，不查 PR 和 issue",
  "  --json        给脚本用，不截断",
].join("\n");

export function parseArgs(argv) {
  const options = { github: true, json: false, help: false };
  for (const arg of argv) {
    if (arg === "--no-github") options.github = false;
    else if (arg === "--json") options.json = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`不认识参数 ${arg}`);
  }
  return options;
}

async function settled(read) {
  try {
    return await read();
  } catch (error) {
    return { error: failReason(error) };
  }
}

export async function readGithub(run = ghJson) {
  const [prs, issues] = await Promise.all([
    settled(async () => ({ list: await run(["pr", "list", "--state", "open", "--limit", "100", "--json", PR_FIELDS]) })),
    settled(async () => ({ numbers: await openIssueNumbers(run) })),
  ]);
  return { prs, issues };
}

function fetchMain(root) {
  return new Promise((resolve) => {
    execFile("git", ["fetch", "-q", "origin", "main"], { cwd: root, windowsHide: true }, (error) => resolve(!error));
  });
}

function lines(text) {
  return (text ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
}

function readCommits(root) {
  const out = tryGit(["log", "--reverse", "--no-merges", "--cherry-pick", "--right-only", "--format=%H%x1f%s%x1f%ct", "origin/main...HEAD"], root);
  return lines(out).map((line) => {
    const [sha, subject = "", time = "0"] = line.split("\x1f");
    return { sha, subject, at: Number(time) * 1000 };
  });
}

function localPrHeads(root, github) {
  if (github.skipped || github.prs.error) return [];
  return github.prs.list.filter((pr) => pr.headRefOid && tryGit(["cat-file", "-e", `${pr.headRefOid}^{commit}`], root) !== null);
}

export async function collect(root, { github: useGithub = true, run = ghJson, now = Date.now() } = {}) {
  const tasks = readAll(root);
  const [github, fetched] = useGithub ? await Promise.all([readGithub(run), fetchMain(root)]) : [{ skipped: true }, true];
  const [behind = 0, ahead = 0] = (tryGit(["rev-list", "--left-right", "--count", "origin/main...HEAD"], root) ?? "").split(/\s+/).map(Number);
  const heads = localPrHeads(root, github);
  const prShas = new Map(heads.map((pr) => [pr.number, new Set(lines(tryGit(["rev-list", `origin/main..${pr.headRefOid}`], root)))]));
  const landed = new Set();
  const heldBy = new Map();
  if (!github.skipped && !github.issues.error) {
    for (const id of issuesToClose(tasks, github.issues.numbers).flatMap((row) => row.ids)) {
      if (landedOnMain(root, id)) landed.add(id);
      else {
        const holder = heads.find((pr) => doneAt(root, pr.headRefOid, id));
        if (holder) heldBy.set(id, holder.number);
      }
    }
  }
  return {
    now,
    tasks,
    stale: (task) => (staleReason(task, { now }) ? staleOf(root, task) : null),
    dirty: readDirty(root),
    branch: tryGit(["rev-parse", "--abbrev-ref", "HEAD"], root) || "HEAD",
    commits: readCommits(root),
    ahead,
    behind,
    fetchFailed: !fetched,
    github,
    prShas,
    landed,
    heldBy,
  };
}

export async function main(argv, { log = console.log } = {}) {
  const options = parseArgs(argv);
  if (options.help) {
    log(HELP);
    return 0;
  }
  const root = git(["rev-parse", "--show-toplevel"]);
  const now = Date.now();
  const summary = summarize(await collect(root, { github: options.github, now }));
  log(options.json ? JSON.stringify({ generatedAt: new Date(now).toISOString(), ...summary }, null, 2) : progressLines(summary, { now }).join("\n"));
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    console.error(`[progress] ${error.message}\n\n${HELP}`);
    process.exitCode = 1;
  }
}
