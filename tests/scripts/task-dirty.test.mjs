import assert from "node:assert/strict";
import { test } from "node:test";
import { dirtyLines, dirtyReport, parseStatus } from "../../scripts/tasks/taskDirty.mjs";

const HOUR = 3600 * 1000;
const now = Date.parse("2026-11-15T20:00:00Z");
const task = (id, scope, status = "进行中") => ({ fields: { id, title: id, status, owner: `s-${id}`, host: "mac", scope } });

test("parseStatus keeps the leading space, marks staged and untracked files and skips rename sources", () => {
  const text = [" M src/a.ts", "M  docs/b.md", "?? new/c.ts", "R  to.ts", "from.ts", ""].join("\0");
  assert.deepEqual(parseStatus(text), [
    { file: "src/a.ts", staged: false, untracked: false },
    { file: "docs/b.md", staged: true, untracked: false },
    { file: "new/c.ts", staged: false, untracked: true },
    { file: "to.ts", staged: true, untracked: false },
  ]);
});

test("dirty files are grouped by the claims that cover them, and the rest are called out", () => {
  const entries = [
    { file: "src/features/a/x.ts", mtimeMs: now - HOUR },
    { file: "docs/tasks/A/A1.md", mtimeMs: now - HOUR },
    { file: "docs/architecture/platforms.md", mtimeMs: now - HOUR, staged: true },
    { file: "src/orphan.ts", mtimeMs: now - 5 * HOUR },
    { file: "gone.ts", mtimeMs: null },
  ];
  const tasks = [task("A1", "src/features/a/"), task("B2", "docs/architecture/platforms.md"), task("C3", "src/", "待做")];
  const report = dirtyReport(entries, tasks, { now });
  assert.deepEqual(report.tasks.map(({ task: t, files }) => [t.fields.id, files.map((f) => f.file)]), [
    ["A1", ["src/features/a/x.ts", "docs/tasks/A/A1.md"]],
    ["B2", ["docs/architecture/platforms.md"]],
  ]);
  assert.deepEqual(report.unowned.map((e) => e.file), ["src/orphan.ts", "gone.ts"]);
  assert.deepEqual(report.quiet.map((e) => e.file), ["src/orphan.ts"]);
  assert.deepEqual(report.hot.map((e) => e.file), ["docs/architecture/platforms.md"]);
  assert.deepEqual(report.staged.map((e) => e.file), ["docs/architecture/platforms.md"]);
  const text = dirtyLines(report, { now }).join("\n");
  assert.match(text, /5 个没提交的文件/);
  assert.match(text, /src\/orphan.ts（5 小时前改的）/);
  assert.match(text, /A1 {2}s-A1 · mac：2 个/);
});

test("a clean work tree says so", () => {
  assert.deepEqual(dirtyLines(dirtyReport([], [], { now }), { now }), ["工作区里没有没提交的文件。"]);
});
