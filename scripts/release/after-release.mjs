import { execFile } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isPrerelease } from "./channel.mjs";

export function ghAsync(args) {
  return new Promise((resolve) => {
    execFile("gh", args, { windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ status: error ? (typeof error.code === "number" ? error.code : 1) : 0, stdout: stdout ?? "", stderr: stderr ?? "" });
    });
  });
}

async function tellOne({ issue, tasks, tag, url, repo, dir, gh }) {
  const existing = await gh(["api", `repos/${repo}/issues/${issue}/comments`, "--paginate", "--jq", ".[].body"]);
  if (existing.status !== 0) return `  #${issue}: could not read its comments, so it was not told.`;
  if (existing.stdout.includes(RELEASED_MARKER(tag))) return null;
  const body = join(dir, `${issue}.md`);
  writeFileSync(body, releasedComment({ tag, url, tasks, repo }));
  const posted = await gh(["issue", "comment", String(issue), "--repo", repo, "--body-file", body]);
  return posted.status === 0 ? `✓ Told #${issue} that it shipped in ${tag}.` : `  #${issue}: the comment failed: ${posted.stderr.trim()}`;
}

export async function tellIssues(shipped, { tag, url, repo, dir, gh = ghAsync, limit = 6 }) {
  const queue = [...shipped];
  const lines = new Map();
  const worker = async () => {
    while (queue.length) {
      const [issue, tasks] = queue.shift();
      lines.set(issue, await tellOne({ issue, tasks, tag, url, repo, dir, gh }));
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));
  return [...shipped.keys()].map((issue) => lines.get(issue)).filter(Boolean);
}

export const RELEASED_MARKER = (tag) => `<!-- released: ${tag} -->`;

export function channelProblems(version, { stable, beta }) {
  const problems = [];
  if (isPrerelease(version)) {
    if (stable === version) problems.push(`The stable channel offers the beta ${version}.`);
  } else if (stable !== version) {
    problems.push(`The stable channel offers ${stable ?? "nothing"}, not ${version}.`);
  }
  if (beta !== version) problems.push(`The beta channel offers ${beta ?? "nothing"}, not ${version}.`);
  return problems;
}

export function parseTask(text) {
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
  const field = (name) => new RegExp(`^${name}:\\s*(.+)$`, "m").exec(front)?.[1].trim() ?? null;
  const section = /^## 提交\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(text)?.[1] ?? "";
  const commits = section
    .split(/\r?\n/)
    .map((line) => /^-\s+(?:`([^`]+)`|([0-9a-f]{7,40})\b)/.exec(line.trim()))
    .filter(Boolean)
    .map((match) => match[1] ?? match[2]);
  const issue = Number(field("issue"));
  return { id: field("id"), issue: Number.isInteger(issue) && issue > 0 ? issue : null, commits };
}

export function shippedIssues(tasks, commits) {
  const subjects = new Set(commits.map(({ subject }) => subject));
  const isHash = (entry) => /^[0-9a-f]{7,40}$/.test(entry);
  const shipped = new Map();
  for (const task of tasks) {
    if (!task.issue) continue;
    const hit = task.commits.some((entry) => subjects.has(entry) || (isHash(entry) && commits.some(({ hash }) => hash.startsWith(entry))));
    if (hit) shipped.set(task.issue, [...(shipped.get(task.issue) ?? []), task]);
  }
  return shipped;
}

export function readTasks(root = "docs/tasks") {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith(".md") && name !== "README.md") files.push(path);
    }
  };
  walk(root);
  return files.map((path) => ({ path: path.replaceAll("\\", "/"), ...parseTask(readFileSync(path, "utf8")) }));
}

export function releasedComment({ tag, url, tasks, repo }) {
  const beta = isPrerelease(tag.replace(/^v/, ""));
  const links = tasks.map(({ id, path }) => `[${id}](https://github.com/${repo}/blob/main/${path})`).join("、");
  return `## 已发布：${tag}

这个 issue 的修改已随 **${tag}**（${beta ? "测试版" : "正式版"}）发布：${url}

在 设置 → 关于 → 版本 里检查更新即可${beta ? "（要先把更新通道选成「测试版」）" : ""}，也可以到上面的 Release 页面下载安装。任务文档：${links}。

---
*本回复由 tixxin Agent Team 的发布脚本在发布后自动发送。*
${RELEASED_MARKER(tag)}
`;
}
