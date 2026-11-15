import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { collect, parseArgs, readGithub } from "../../scripts/progress/progress.mjs";
import { LIMITS, displayWidth, fit, prState, progressLines, summarize } from "../../scripts/progress/report.mjs";
import { formatTask } from "../../scripts/tasks/taskFile.mjs";
import {
  closeReminder, doneAt, doneIdsInMerge, failReason, issuesToClose, mergedReminder, mergedReminderLines, openIssueNumbers,
} from "../../scripts/tasks/taskIssues.mjs";

const NOW = Date.parse("2026-11-15T12:00:00Z");
const HOUR = 3_600_000;

function task(id, fields = {}, body = "") {
  return { fields: { id, title: `任务 ${id}`, status: "待做", scope: [], depends: [], ...fields }, body };
}

function doing(id, owner, host, fields = {}, body = "") {
  return task(id, { status: "进行中", owner, host, claimed: "2026-11-15 10:00", ...fields }, body);
}

function done(id, fields = {}) {
  return task(id, { status: "已完成", done: "2026-11-15", ...fields }, "## 提交\n\n- `feat(x): y`");
}

function pr(number, fields = {}) {
  return { number, title: `PR ${number}`, headRefName: `land/t/mac-main-${number}`, author: { login: "t" }, autoMergeRequest: {}, mergeStateStatus: "BLOCKED", statusCheckRollup: [], ...fields };
}

function facts(overrides = {}) {
  return {
    now: NOW,
    tasks: [],
    dirty: [],
    commits: [],
    ahead: 0,
    behind: 0,
    github: { prs: { list: [] }, issues: { numbers: [] } },
    ...overrides,
  };
}

function report(overrides) {
  return progressLines(summarize(facts(overrides)), { now: NOW });
}

test("a done task is reported only when its issue is open and no other task still hangs on it", () => {
  const tasks = [
    done("F1", { issue: "10" }),
    done("F2", { issue: "11" }),
    done("F3", { issue: "12" }),
    doing("F4", "s", "mac", { issue: "12" }),
    task("F5", { status: "不做", issue: "13" }),
    done("F6", { issue: "14" }),
    task("F7", { status: "不做", issue: "14" }),
    done("F8"),
  ];
  assert.deepEqual(issuesToClose(tasks, [10, 12, 13, 14, 99]), [
    { issue: 10, ids: ["F1"], title: "任务 F1" },
    { issue: 14, ids: ["F6"], title: "任务 F6" },
  ]);
  assert.deepEqual(issuesToClose(tasks, []), []);
});

test("in-progress tasks show the session and machine as written, with their uncommitted files, issue and handoff", () => {
  const tasks = [
    doing("E36.3.3", "v3-rust-channel", "tixxindemacbook-air", { scope: ["src-tauri/"], issue: "467" }, "## 交接\n\n- 做到一半"),
    doing("C80", "voice-input", "tixxindeair", { scope: ["src/features/voice/"], issue: "335" }),
    task("B6", { status: "进行中" }),
    task("B6.1", { parent: "B6", status: "已完成" }),
    task("B6.2", { parent: "B6" }),
    task("F9"),
  ];
  const dirty = [
    { file: "src-tauri/src/lib.rs", staged: true, mtimeMs: NOW - 5 * HOUR },
    { file: "src-tauri/src/a.rs", staged: false, mtimeMs: NOW },
    { file: "src/features/voice/x.ts", staged: false, mtimeMs: NOW },
    { file: "notes.txt", staged: false, untracked: true, mtimeMs: NOW },
  ];
  const lines = report({ tasks, dirty, stale: (item) => (item.fields.id === "C80" ? "认领后超过 24 小时没有动静" : null) });
  assert.match(lines[0], /^进行中 3 项/);
  assert.match(lines[1], /^ {2}C80 +voice-input · tixxindeair +没提交 1 个 +#335 +⚠ 超过 24 小时没动静$/);
  assert.match(lines[2], /^ {2}E36\.3\.3 +v3-rust-channel · tixxindemacbook-air +没提交 2 个 +#467 +有交接$/);
  assert.match(lines[3], /^ {2}B6 +没有负责人 · 子任务 1\/2$/);
  assert.equal(lines[4], "没提交的文件 4 个：热点 1，没人认领 1，超过 3 小时没动 1，已暂存 1（pnpm tasks dirty）");
  assert.ok(!lines.join("\n").includes("本机"), "no this-machine wording");
});

test("commits already in an open PR are counted apart from the ones not pushed, and the branch being behind is said", () => {
  const commits = [
    { sha: "a", subject: "feat: one", at: NOW - 7 * HOUR },
    { sha: "b", subject: "feat: two", at: NOW - 2 * HOUR },
    { sha: "c", subject: "feat: three", at: NOW - HOUR / 2 },
  ];
  const waiting = report({ commits, behind: 61, ahead: 16, branch: "main", prShas: new Map([[498, new Set(["a"])]]) });
  const at = waiting.findIndex((line) => line.startsWith("没推的提交"));
  assert.equal(waiting[at], "没推的提交 2 个，最早的 2 小时前，还不用提 PR；另有 1 个在 #498 里等合入");
  assert.deepEqual(waiting.slice(at + 1, at + 4), ["  feat: three", "  feat: two", "本地 main 落后 origin/main 61 个提交（pnpm mq:sync）"]);

  const due = report({ commits });
  assert.match(due.find((line) => line.startsWith("没推的提交")), /^没推的提交 3 个，最早的 7 小时前，该提 PR 了（pnpm mq:land/);
  assert.ok(!due.some((line) => line.includes("落后")));

  const summary = summarize(facts({ commits, behind: 61, ahead: 16, prShas: new Map([[498, new Set(["a"])]]) }));
  assert.deepEqual(summary.commits.inPr, [{ number: 498, count: 1 }]);
  assert.equal(summary.commits.total, 3);
  assert.equal(summary.commits.ahead, 16);

  assert.equal(report({ commits: [], fetchFailed: true }).find((line) => line.startsWith("没推的提交")), "没推的提交 0 个；取不到 origin/main，按上次取到的算");
});

test("each open PR says what it is waiting for", () => {
  assert.deepEqual(prState(pr(1)), ["自动合并已开", "等检查"]);
  assert.deepEqual(prState(pr(2, { mergeStateStatus: "BEHIND" })), ["自动合并已开", "落后于 main"]);
  assert.deepEqual(prState(pr(3, { mergeStateStatus: "DIRTY", autoMergeRequest: null })), ["没开自动合并", "和 main 冲突"]);
  assert.deepEqual(prState(pr(4, { mergeStateStatus: "CLEAN", isDraft: true })), ["草稿", "自动合并已开", "可以合入"]);
  const failing = pr(5, { mergeStateStatus: "BEHIND", statusCheckRollup: [{ name: "check", conclusion: "FAILURE" }, { name: "rust", conclusion: "SUCCESS" }] });
  assert.deepEqual(prState(failing), ["自动合并已开", "落后于 main", "检查没过（check）"]);
  assert.deepEqual(prState(pr(6, { mergeStateStatus: "UNKNOWN" })), ["自动合并已开", "状态还没算出来"]);

  const lines = report({ github: { prs: { list: [pr(493, { mergeStateStatus: "BEHIND" }), pr(498), pr(7, { headRefName: "fix/x", author: { login: "ShengLin1001" } })] }, issues: { numbers: [] } } });
  const at = lines.indexOf("开着的 PR 3 个");
  assert.ok(at > 0);
  assert.match(lines[at + 1], /^ {2}#498 +PR 498 +自动合并已开 · 等检查$/);
  assert.match(lines[at + 2], /^ {2}#493 +PR 493 +自动合并已开 · 落后于 main$/);
  assert.match(lines[at + 3], /^ {2}#7 +PR 7 · ShengLin1001 +自动合并已开 · 等检查$/);
});

test("a done task whose issue is open is told apart by whether it has reached main", () => {
  const tasks = [done("B43", { issue: "391" }), done("E36.2.2", { issue: "425" }), done("C78", { issue: "333" }), task("F9", { needs: "user" })];
  const lines = report({
    tasks,
    github: { prs: { list: [pr(493)] }, issues: { numbers: [333, 391, 425] } },
    landed: new Set(["C78"]),
    heldBy: new Map([["E36.2.2", 493]]),
  });
  const at = lines.findIndex((line) => line.startsWith("任务已完成、issue 还开着"));
  assert.match(lines[at], /^任务已完成、issue 还开着 3 个，其中已合入 1 个/);
  assert.match(lines[at + 1], /^ {2}#333 +C78 +已合入，可以回复并关闭 +任务 C78$/);
  assert.match(lines[at + 2], /^ {2}#391 +B43 +还没合入 +任务 B43$/);
  assert.match(lines[at + 3], /^ {2}#425 +E36\.2\.2 +还没合入（在 #493 里） +任务 E36\.2\.2$/);
  assert.equal(lines.at(-1), "等你的 1 项（pnpm tasks）");

  const none = report({ tasks, github: { prs: { list: [] }, issues: { numbers: [] } } });
  assert.ok(none.includes("任务已完成、issue 还开着 0 个"));
  assert.ok(none.includes("开着的 PR 0 个"));
});

test("when gh fails the local parts still print and the reason is given", async () => {
  const denied = Object.assign(new Error("Command failed: gh pr list"), { stderr: "\nHTTP 401: Bad credentials (https://api.github.com/graphql)\nTry authenticating with: gh auth login\n" });
  const github = await readGithub(async () => { throw denied; });
  assert.deepEqual(github, { prs: { error: "HTTP 401: Bad credentials (https://api.github.com/graphql)" }, issues: { error: "HTTP 401: Bad credentials (https://api.github.com/graphql)" } });
  assert.equal(failReason(Object.assign(new Error("spawn gh ENOENT"), { code: "ENOENT" })), "没有装 gh");
  assert.equal(failReason(Object.assign(new Error("x"), { killed: true })), "gh 超时");

  const tasks = [doing("F45", "progress", "mac", { issue: "508" }), done("F1", { issue: "10" })];
  const lines = report({ tasks, github, commits: [{ sha: "a", subject: "feat: one", at: NOW - HOUR }] });
  assert.match(lines[0], /^进行中 1 项/);
  assert.ok(lines.some((line) => line.startsWith("没提交的文件 0 个")));
  assert.ok(lines.some((line) => line.startsWith("没推的提交 1 个")));
  assert.ok(lines.includes("开着的 PR：取不到（HTTP 401: Bad credentials (https://api.github.com/graphql)）"));
  assert.ok(lines.includes("任务已完成、issue 还开着：取不到（HTTP 401: Bad credentials (https://api.github.com/graphql)）"));

  const half = await readGithub(async (args) => {
    if (args[0] === "pr") throw denied;
    return [{ number: 10 }];
  });
  assert.deepEqual(half.issues, { numbers: [10] });
  assert.ok(report({ tasks, github: half }).some((line) => line.startsWith("任务已完成、issue 还开着 1 个")));

  const offline = report({ tasks, github: { skipped: true } });
  assert.ok(offline.includes("开着的 PR：没查（--no-github）"));
  assert.ok(offline.includes("任务已完成、issue 还开着：没查（--no-github）"));
  assert.deepEqual(await openIssueNumbers(async () => [{ number: 3 }, { number: 9 }]), [3, 9]);
});

test("the report stays within one screen however much there is", () => {
  const tasks = [];
  for (let i = 1; i <= 40; i += 1) tasks.push(doing(`C${i}`, `会话名字很长很长很长很长很长很长很长很长-${i}`, "tixxindemacbook-air", { issue: String(100 + i) }));
  for (let i = 1; i <= 30; i += 1) tasks.push(done(`F${i}`, { issue: String(200 + i) }));
  const commits = Array.from({ length: 60 }, (_, i) => ({ sha: `s${i}`, subject: `feat: ${"很长的标题".repeat(30)} ${i}`, at: NOW - i * HOUR }));
  const prs = Array.from({ length: 12 }, (_, i) => pr(i + 1, { title: "标题".repeat(60) }));
  const lines = report({
    tasks: [...tasks, task("F99", { needs: "user" })],
    commits,
    behind: 9,
    dirty: Array.from({ length: 200 }, (_, i) => ({ file: `src/x${i}.ts`, staged: false, mtimeMs: NOW })),
    github: { prs: { list: prs }, issues: { numbers: Array.from({ length: 30 }, (_, i) => 201 + i) } },
  });
  assert.ok(lines.length <= 40, `${lines.length} lines`);
  assert.ok(lines.every((line) => displayWidth(line) <= 160), "no line runs away");
  assert.ok(lines.includes(`  … 还有 ${40 - LIMITS.tasks} 项（pnpm tasks）`));
  assert.ok(lines.includes(`  … 还有 ${60 - LIMITS.commits} 个（pnpm mq:pending）`));
  assert.ok(lines.includes(`  … 还有 ${12 - LIMITS.prs} 个（gh pr list）`));
  assert.ok(lines.some((line) => line.startsWith(`  … 还有 ${30 - LIMITS.issues} 个：#206 #207`)));
  const summary = summarize(facts({ tasks, github: { prs: { list: prs }, issues: { numbers: Array.from({ length: 30 }, (_, i) => 201 + i) } } }));
  assert.equal(summary.inProgress.length, 40, "json keeps every row");
  assert.equal(summary.issues.list.length, 30);
  assert.equal(fit("一二三四五", 6), "一二…");
  assert.equal(displayWidth("a一"), 3);
});

test("after a merge the open issues of that batch's done tasks are listed", () => {
  const tasks = [done("F1", { issue: "10" }), done("F2", { issue: "11" }), done("F3"), done("F4", { issue: "12" }), doing("F5", "s", "mac", { issue: "13" })];
  assert.deepEqual(mergedReminderLines(tasks, ["F1", "F2", "F3", "F5"], { numbers: [10, 12, 13] }), [
    "这一批里完成的任务还有 1 个 issue 开着，回复完成情况后关闭（docs/tasks/README.md「GitHub issue」）：",
    "  #10  F1  任务 F1",
  ]);
  assert.deepEqual(mergedReminderLines(tasks, ["F1", "F2"], { numbers: [] }), []);
  assert.deepEqual(mergedReminderLines(tasks, ["F3"], { numbers: [10] }), []);
  assert.deepEqual(mergedReminderLines(tasks, ["F1", "F2"], { error: "没有装 gh" }), [
    "取不到 issue 的状态（没有装 gh）。这一批完成的任务带着这些 issue，确认都回复并关闭了：#10（F1）、#11（F2）",
  ]);
  assert.match(closeReminder({ id: "F1", issue: "10" }), /^F1 对应 #10：合入 main 后回复完成情况并关闭/);
  assert.equal(closeReminder({ id: "F3" }), null);
});

test("the tasks a merge finished are read from the merge commit, in a real repository", async () => {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "fuyu-progress-")));
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")));
  const git = (...args) => execFileSync("git", args, { cwd: root, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const write = (file, item) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), formatTask(item));
  };
  const saved = Object.keys(process.env).filter((name) => name.startsWith("GIT_")).map((name) => [name, process.env[name]]);
  for (const [name] of saved) delete process.env[name];
  try {
    git("init", "-q", "-b", "main");
    git("config", "user.email", "t@example.com");
    git("config", "user.name", "t");
    git("config", "commit.gpgsign", "false");
    write("docs/tasks/F/F1.md", doing("F1", "s", "mac", { issue: "10" }));
    write("docs/tasks/F/F2.md", doing("F2", "s", "mac"));
    write("docs/tasks/0-archive/F/F0.md", done("F0", { issue: "9" }));
    git("add", "-A");
    git("commit", "-q", "--no-verify", "-m", "start");
    git("mv", "docs/tasks/F/F1.md", "docs/tasks/0-archive/F/F1.md");
    write("docs/tasks/0-archive/F/F1.md", done("F1", { issue: "10" }));
    write("docs/tasks/0-archive/F/F0.md", done("F0", { issue: "9" }, "note"));
    git("add", "-A");
    git("commit", "-q", "--no-verify", "-m", "feat(x): y");
    const head = git("rev-parse", "HEAD");
    git("update-ref", "refs/remotes/origin/main", head);

    assert.deepEqual(doneIdsInMerge(root, head), ["F1"], "F0 was archived before this merge");
    assert.deepEqual(doneIdsInMerge(root, ""), []);
    assert.equal(doneAt(root, head, "F1"), true);
    assert.equal(doneAt(root, `${head}^`, "F1"), false);
    assert.deepEqual(await mergedReminder(root, head, { openIssues: async () => [9, 10] }), [
      "这一批里完成的任务还有 1 个 issue 开着，回复完成情况后关闭（docs/tasks/README.md「GitHub issue」）：",
      "  #10  F1  任务 F1",
    ]);
    assert.deepEqual(await mergedReminder(root, head, { openIssues: async () => [] }), []);
    const failed = await mergedReminder(root, head, { openIssues: async () => { throw Object.assign(new Error("x"), { code: "ENOENT" }); } });
    assert.match(failed[0], /^取不到 issue 的状态（没有装 gh）.*#10（F1）$/);
    assert.deepEqual(await mergedReminder(root, "0000000", { openIssues: async () => [10] }), []);

    writeFileSync(path.join(root, "loose.txt"), "x");
    const found = await collect(root, { run: async (args) => (args[0] === "pr" ? [] : [{ number: 9 }, { number: 10 }]), now: NOW });
    assert.deepEqual([...found.landed].sort(), ["F0", "F1"]);
    assert.deepEqual(found.dirty.map((entry) => entry.file), ["loose.txt"]);
    assert.equal(found.branch, "main");
    const offline = await collect(root, { github: false, now: NOW });
    assert.deepEqual(offline.github, { skipped: true });
    assert.equal(offline.fetchFailed, false);
  } finally {
    for (const [name, value] of saved) process.env[name] = value;
    rmSync(root, { recursive: true, force: true });
  }
});

test("progress takes two flags and refuses the rest", () => {
  assert.deepEqual(parseArgs([]), { github: true, json: false, help: false });
  assert.deepEqual(parseArgs(["--no-github", "--json"]), { github: false, json: true, help: false });
  assert.equal(parseArgs(["-h"]).help, true);
  assert.throws(() => parseArgs(["--all"]), /不认识参数 --all/);
});
