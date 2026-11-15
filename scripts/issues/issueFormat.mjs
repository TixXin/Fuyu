export const REPO = "TixXin/fuyu";
export const VIEW_FIELDS = "number,title,state,author,labels,createdAt,url,body,comments";
export const LIST_FIELDS = "number,title,state,author,labels,createdAt,updatedAt,comments";

export function parseArgs(argv) {
  const options = { numbers: [], json: false, state: "open", untracked: false, limit: 100 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") options.json = true;
    else if (arg === "--untracked") options.untracked = true;
    else if (arg === "--all") options.state = "all";
    else if (arg === "--closed") options.state = "closed";
    else if (arg === "--limit") options.limit = Number(argv[++index]);
    else if (/^#?\d+$/.test(arg)) options.numbers.push(Number(arg.replace("#", "")));
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!Number.isInteger(options.limit) || options.limit < 1) throw new Error("--limit needs a positive number");
  return options;
}

export function tasksByIssue(tasks) {
  const map = new Map();
  for (const task of tasks) {
    const issue = Number(task.fields.issue);
    if (!Number.isInteger(issue) || issue < 1) continue;
    if (!map.has(issue)) map.set(issue, []);
    map.get(issue).push(task);
  }
  return map;
}

function day(iso) {
  return String(iso ?? "").slice(0, 10);
}

function login(author) {
  return author?.login ?? "?";
}

function labelText(labels) {
  const names = (labels ?? []).map((label) => label.name);
  return names.length ? ` [${names.join(", ")}]` : "";
}

export function taskLine(task) {
  const { id, title, status, owner } = task.fields;
  return `${id} ${status}${owner ? `（${owner}）` : ""} ${title}`;
}

export function issueRow(issue, tasks = []) {
  const linked = tasks.length ? tasks.map((task) => `${task.fields.id} ${task.fields.status}`).join("、") : "无任务";
  const comments = Array.isArray(issue.comments) ? issue.comments.length : Number(issue.comments ?? 0);
  return `#${issue.number} ${day(issue.createdAt)} ${issue.title}${labelText(issue.labels)} · ${login(issue.author)} · ${comments} 条回复 · ${linked}`;
}

export function listLines(issues, byIssue, { untracked = false } = {}) {
  const rows = issues.filter((issue) => !untracked || !byIssue.has(issue.number));
  if (!rows.length) return [untracked ? "没有未建任务的 issue" : "没有 issue"];
  return rows.map((issue) => issueRow(issue, byIssue.get(issue.number)));
}

export function viewLines(issue, tasks = []) {
  const lines = [
    `#${issue.number} ${issue.title}`,
    `${issue.state} · ${login(issue.author)} · ${day(issue.createdAt)}${labelText(issue.labels)}`,
    issue.url ?? "",
    "",
    (issue.body ?? "").trim() || "（没有正文）",
    "",
  ];
  const comments = issue.comments ?? [];
  lines.push(`## 回复（${comments.length}）`);
  for (const comment of comments) {
    lines.push("", `### ${login(comment.author)} · ${day(comment.createdAt)}`, (comment.body ?? "").trim());
  }
  lines.push("", "## 任务");
  if (tasks.length) lines.push(...tasks.map(taskLine));
  else lines.push("还没有任务：pnpm tasks add <编号> --title .. --issue " + issue.number);
  return lines;
}
