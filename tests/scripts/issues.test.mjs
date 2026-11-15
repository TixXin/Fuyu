import assert from "node:assert/strict";
import test from "node:test";
import { issueRow, listLines, parseArgs, tasksByIssue, viewLines } from "../../scripts/issues/issueFormat.mjs";

const task = (id, issue, status = "待做", owner = "") => ({ fields: { id, title: `任务 ${id}`, status, owner, issue } });

test("parseArgs reads numbers, flags and the limit", () => {
  assert.deepEqual(parseArgs(["#349", "12", "--json"]), { numbers: [349, 12], json: true, state: "open", untracked: false, limit: 100 });
  assert.equal(parseArgs(["--all"]).state, "all");
  assert.equal(parseArgs(["--closed", "--limit", "5"]).limit, 5);
  assert.equal(parseArgs(["--untracked"]).untracked, true);
  assert.throws(() => parseArgs(["--nope"]), /unknown argument/);
  assert.throws(() => parseArgs(["--limit", "0"]), /positive/);
});

test("tasksByIssue groups tasks by their issue and skips tasks without one", () => {
  const map = tasksByIssue([task("B30", "349"), task("B31", "358"), task("B32", ""), task("B33", "349")]);
  assert.deepEqual([...map.keys()], [349, 358]);
  assert.deepEqual(map.get(349).map((t) => t.fields.id), ["B30", "B33"]);
});

test("list rows show linked tasks and --untracked keeps only issues without one", () => {
  const issues = [
    { number: 349, title: "opencode", createdAt: "2026-11-15T01:00:00Z", author: { login: "jyzhiyu" }, labels: [], comments: [{}, {}] },
    { number: 12, title: "旧问题", createdAt: "2026-11-01T01:00:00Z", author: { login: "x" }, labels: [{ name: "bug" }], comments: [] },
  ];
  const byIssue = tasksByIssue([task("B30", "349", "进行中")]);
  assert.equal(issueRow(issues[0], byIssue.get(349)), "#349 2026-11-15 opencode · jyzhiyu · 2 条回复 · B30 进行中");
  assert.deepEqual(listLines(issues, byIssue, { untracked: true }), ["#12 2026-11-01 旧问题 [bug] · x · 0 条回复 · 无任务"]);
  assert.deepEqual(listLines([], byIssue), ["没有 issue"]);
});

test("viewLines prints the body, every comment and the linked tasks", () => {
  const issue = {
    number: 349,
    title: "opencode",
    state: "OPEN",
    author: { login: "jyzhiyu" },
    labels: [],
    createdAt: "2026-11-15T01:00:00Z",
    url: "https://github.com/TixXin/fuyu/issues/349",
    body: "加入 opencode",
    comments: [{ author: { login: "TixXin" }, createdAt: "2026-11-15T02:00:00Z", body: "收到" }],
  };
  const text = viewLines(issue, [task("B30", "349", "进行中", "opencode")]).join("\n");
  assert.match(text, /^#349 opencode\nOPEN · jyzhiyu · 2026-11-15/);
  assert.match(text, /## 回复（1）\n\n### TixXin · 2026-11-15\n收到/);
  assert.match(text, /## 任务\nB30 进行中（opencode） 任务 B30$/);
  assert.match(viewLines({ ...issue, comments: [] }, []).join("\n"), /还没有任务：pnpm tasks add <编号> --title \.\. --issue 349/);
});
