import { failedChecks } from "../mq/github.mjs";
import { batchAdvice } from "../mq/mq.mjs";
import { forUser, index, progress } from "../tasks/taskBoard.mjs";
import { dirtyReport } from "../tasks/taskDirty.mjs";
import { OPEN_STATUSES, claimText, compareIds, sectionText } from "../tasks/taskFile.mjs";
import { issuesToClose } from "../tasks/taskIssues.mjs";

export const LIMITS = { tasks: 16, commits: 3, prs: 4, issues: 5 };
const WHO_WIDTH = 40;
const TITLE_WIDTH = 48;
const SUBJECT_WIDTH = 100;

function charWidth(char) {
  return /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(char) ? 2 : 1;
}

export function displayWidth(text) {
  let width = 0;
  for (const char of text) width += charWidth(char);
  return width;
}

export function fit(text, width) {
  if (displayWidth(text) <= width) return text;
  let out = "";
  let used = 0;
  for (const char of text) {
    used += charWidth(char);
    if (used > width - 1) break;
    out += char;
  }
  return `${out}…`;
}

function pad(text, width) {
  return text + " ".repeat(Math.max(0, width - displayWidth(text)));
}

function taskRows(tasks, dirty, stale) {
  const { children } = index(tasks);
  const counts = new Map(dirty.tasks.map(({ task, files }) => [task.fields.id, files.length]));
  return tasks
    .filter((task) => task.fields.status === "进行中")
    .sort((a, b) => Number(!a.fields.owner) - Number(!b.fields.owner) || compareIds(a.fields.id, b.fields.id))
    .map((task) => ({
      id: task.fields.id,
      title: task.fields.title,
      owner: task.fields.owner ?? null,
      host: task.fields.host ?? null,
      who: task.fields.owner ? claimText(task.fields) : "",
      dirty: counts.get(task.fields.id) ?? 0,
      issue: Number(task.fields.issue) || null,
      handoff: Boolean(sectionText(task.body, "交接")),
      stale: Boolean(stale(task)),
      children: progress(task, children),
    }));
}

function pendingState(rollup = []) {
  return rollup.some((check) => (check.status && check.status !== "COMPLETED") || check.state === "PENDING" || check.state === "EXPECTED");
}

export function prState(pr) {
  const parts = [];
  if (pr.isDraft) parts.push("草稿");
  parts.push(pr.autoMergeRequest ? "自动合并已开" : "没开自动合并");
  const failed = failedChecks(pr.statusCheckRollup ?? []);
  if (pr.mergeStateStatus === "DIRTY") parts.push("和 main 冲突");
  if (pr.mergeStateStatus === "BEHIND") parts.push("落后于 main");
  if (failed.length) parts.push(`检查没过（${failed.map((check) => check.name).join("、")}）`);
  else if (pr.mergeStateStatus === "CLEAN" || pr.mergeStateStatus === "HAS_HOOKS") parts.push("可以合入");
  else if (pr.mergeStateStatus === "BLOCKED" || pr.mergeStateStatus === "UNSTABLE" || pendingState(pr.statusCheckRollup)) parts.push("等检查");
  else if (!["DIRTY", "BEHIND"].includes(pr.mergeStateStatus)) parts.push("状态还没算出来");
  return parts;
}

function commitSummary({ commits = [], prShas = new Map(), ahead = 0, behind = 0, branch = "main", fetchFailed = false, now }) {
  const inPr = [];
  const held = new Set();
  for (const [number, shas] of prShas) {
    const count = commits.filter((commit) => shas.has(commit.sha) && !held.has(commit.sha)).length;
    for (const commit of commits) if (shas.has(commit.sha)) held.add(commit.sha);
    if (count) inPr.push({ number, count });
  }
  const unpushed = commits.filter((commit) => !held.has(commit.sha)).map(({ subject, at }) => ({ subject, at }));
  return {
    branch,
    total: commits.length,
    unpushed,
    inPr,
    oldestAt: unpushed.length ? Math.min(...unpushed.map((commit) => commit.at)) : null,
    due: batchAdvice(unpushed, now).due,
    ahead,
    behind,
    fetchFailed,
  };
}

function githubSummary(facts) {
  const { github = { skipped: true }, tasks, landed = new Set(), heldBy = new Map() } = facts;
  if (github.skipped) return { prs: { skipped: true }, issues: { skipped: true } };
  const prs = github.prs.error
    ? { error: github.prs.error }
    : {
      list: [...github.prs.list].sort((a, b) => b.number - a.number).map((pr) => ({
        number: pr.number,
        title: pr.title ?? "",
        branch: pr.headRefName ?? "",
        author: pr.author?.login ?? "",
        url: pr.url ?? "",
        state: prState(pr),
      })),
    };
  const issues = github.issues.error
    ? { error: github.issues.error }
    : {
      list: issuesToClose(tasks, github.issues.numbers)
        .map((row) => {
          const merged = row.ids.every((id) => landed.has(id));
          return { ...row, merged, pr: merged ? null : row.ids.map((id) => heldBy.get(id)).find(Boolean) ?? null };
        })
        .sort((a, b) => Number(b.merged) - Number(a.merged) || a.issue - b.issue),
    };
  return { prs, issues };
}

export function summarize(facts) {
  const { tasks, now = Date.now(), stale = () => null, dirty: entries = [] } = facts;
  const dirty = dirtyReport(entries, tasks, { now });
  return {
    inProgress: taskRows(tasks, dirty, stale),
    dirty: {
      total: dirty.total,
      hot: dirty.hot.length,
      unowned: dirty.unowned.length,
      quiet: dirty.quiet.length,
      staged: dirty.staged.length,
      quietHours: dirty.quietHours,
    },
    commits: commitSummary({ ...facts, now }),
    ...githubSummary(facts),
    forUser: tasks
      .filter((task) => forUser(task) && OPEN_STATUSES.includes(task.fields.status))
      .map((task) => ({ id: task.fields.id, title: task.fields.title })),
  };
}

function ago(at, now) {
  const minutes = Math.max(0, Math.round((now - at) / 60_000));
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 48 * 60) return `${Math.floor(minutes / 60)} 小时前`;
  return `${Math.floor(minutes / 1440)} 天前`;
}

function capped(rows, limit, more) {
  if (rows.length <= limit) return rows;
  return [...rows.slice(0, limit), `  … 还有 ${rows.length - limit} ${more}`];
}

function taskLines(rows) {
  if (!rows.length) return ["进行中 0 项"];
  const who = (row) => fit(row.who || `没有负责人${row.children ? ` · 子任务 ${row.children.done}/${row.children.total}` : ""}`, WHO_WIDTH);
  const dirty = (row) => (row.dirty ? `没提交 ${row.dirty} 个` : "");
  const shown = rows.slice(0, LIMITS.tasks);
  const idWidth = Math.max(...shown.map((row) => row.id.length));
  const whoWidth = Math.max(...shown.map((row) => displayWidth(who(row))));
  const dirtyWidth = Math.max(...shown.map((row) => displayWidth(dirty(row))));
  const issueWidth = Math.max(...shown.map((row) => (row.issue ? String(row.issue).length + 1 : 0)));
  const lines = rows.map((row) => {
    const marks = [row.handoff ? "有交接" : "", row.stale ? "⚠ 超过 24 小时没动静" : ""].filter(Boolean).join(" · ");
    const cells = [row.id.padEnd(idWidth), pad(who(row), whoWidth), pad(dirty(row), dirtyWidth), pad(row.issue ? `#${row.issue}` : "", issueWidth), marks];
    return `  ${cells.join("   ")}`.trimEnd();
  });
  return [`进行中 ${rows.length} 项（一项的全文 pnpm tasks show <编号>）`, ...capped(lines, LIMITS.tasks, "项（pnpm tasks）")];
}

function dirtyLine(dirty) {
  if (!dirty.total) return "没提交的文件 0 个";
  return `没提交的文件 ${dirty.total} 个：热点 ${dirty.hot}，没人认领 ${dirty.unowned}，超过 ${dirty.quietHours} 小时没动 ${dirty.quiet}，已暂存 ${dirty.staged}（pnpm tasks dirty）`;
}

function commitLines(commits, now) {
  const parts = [`没推的提交 ${commits.unpushed.length} 个`];
  if (commits.unpushed.length) {
    parts[0] += `，最早的 ${ago(commits.oldestAt, now)}，${commits.due ? "该提 PR 了（pnpm mq:land）" : "还不用提 PR"}`;
  }
  if (commits.inPr.length) parts.push(`另有 ${commits.inPr.map(({ number, count }) => `${count} 个在 #${number} 里`).join("、")}等合入`);
  if (commits.fetchFailed) parts.push("取不到 origin/main，按上次取到的算");
  const subjects = [...commits.unpushed].reverse().map((commit) => `  ${fit(commit.subject, SUBJECT_WIDTH)}`);
  const lines = [parts.join("；"), ...capped(subjects, LIMITS.commits, "个（pnpm mq:pending）")];
  if (commits.behind) lines.push(`本地 ${commits.branch} 落后 origin/main ${commits.behind} 个提交（pnpm mq:sync）`);
  return lines;
}

function prLines(prs) {
  if (prs.skipped) return ["开着的 PR：没查（--no-github）"];
  if (prs.error) return [`开着的 PR：取不到（${prs.error}）`];
  if (!prs.list.length) return ["开着的 PR 0 个"];
  const shown = prs.list.slice(0, LIMITS.prs);
  const name = (pr) => fit(`${pr.title}${pr.branch.startsWith("land/") || !pr.author ? "" : ` · ${pr.author}`}`, TITLE_WIDTH);
  const numberWidth = Math.max(...shown.map((pr) => String(pr.number).length)) + 1;
  const nameWidth = Math.max(...shown.map((pr) => displayWidth(name(pr))));
  const lines = prs.list.map((pr) => `  ${`#${pr.number}`.padEnd(numberWidth)}  ${pad(name(pr), nameWidth)}   ${pr.state.join(" · ")}`);
  return [`开着的 PR ${prs.list.length} 个`, ...capped(lines, LIMITS.prs, "个（gh pr list）")];
}

function issueLines(issues) {
  if (issues.skipped) return ["任务已完成、issue 还开着：没查（--no-github）"];
  if (issues.error) return [`任务已完成、issue 还开着：取不到（${issues.error}）`];
  if (!issues.list.length) return ["任务已完成、issue 还开着 0 个"];
  const shown = issues.list.slice(0, LIMITS.issues);
  const state = (row) => (row.merged ? "已合入，可以回复并关闭" : `还没合入${row.pr ? `（在 #${row.pr} 里）` : ""}`);
  const numberWidth = Math.max(...shown.map((row) => String(row.issue).length)) + 1;
  const idWidth = Math.max(...shown.map((row) => displayWidth(row.ids.join("、"))));
  const stateWidth = Math.max(...shown.map((row) => displayWidth(state(row))));
  const lines = issues.list.map((row) => `  ${`#${row.issue}`.padEnd(numberWidth)}  ${pad(row.ids.join("、"), idWidth)}   ${pad(state(row), stateWidth)}   ${fit(row.title, TITLE_WIDTH)}`);
  const merged = issues.list.filter((row) => row.merged).length;
  const rest = issues.list.slice(LIMITS.issues).map((row) => `#${row.issue}`);
  return [
    `任务已完成、issue 还开着 ${issues.list.length} 个，其中已合入 ${merged} 个（回复格式见 docs/tasks/README.md「GitHub issue」）`,
    ...lines.slice(0, LIMITS.issues),
    ...(rest.length ? [`  ${fit(`… 还有 ${rest.length} 个：${rest.join(" ")}`, SUBJECT_WIDTH)}`] : []),
  ];
}

export function progressLines(summary, { now = Date.now() } = {}) {
  const lines = [
    ...taskLines(summary.inProgress),
    dirtyLine(summary.dirty),
    ...commitLines(summary.commits, now),
    ...prLines(summary.prs),
    ...issueLines(summary.issues),
  ];
  if (summary.forUser.length) lines.push(`等你的 ${summary.forUser.length} 项（pnpm tasks）`);
  return lines;
}
