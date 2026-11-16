import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { buildModel, deriveStatus } from "../../scripts/progress/html/model.mjs";
import { renderReport } from "../../scripts/progress/html/page.mjs";
import { defaultOut, main, parseArgs } from "../../scripts/progress/report-html.mjs";

function data(overrides = {}) {
  return {
    tz: "UTC",
    progress: {
      generatedAt: "2026-11-16T13:00:00Z",
      inProgress: [
        { id: "D84.1", title: "轮询", owner: "d84-1", host: "mac", dirty: 3, issue: 714, stale: false, children: null },
        { id: "C97", title: "液态玻璃", owner: "fuyu-0f", host: "desktop", dirty: 0, issue: 495, stale: false, children: null },
      ],
      dirty: { total: 12 },
      commits: { unpushed: [{ subject: "docs(tasks): f60 takes F60", at: 0 }], ahead: 2, behind: 0 },
      prs: { list: [
        { number: 712, title: "liquid glass presets", author: "ShengLin1001", state: ["自动合并已开", "检查没过（check）"] },
        { number: 713, title: "file shelf runner", author: "TixXin", state: ["自动合并已开", "可以合入"] },
      ] },
      issues: { list: [
        { issue: 650, ids: ["F55"], title: "three merge rules", merged: true },
        { issue: 701, ids: ["D85.3"], title: "motion tokens", merged: false },
      ] },
      forUser: [{ id: "G1.32", title: "Mac 截图实测" }],
    },
    sessions: [
      { sessionId: "ctl", title: "Fuyu-[总控] 流程与文档", isRunning: false },
      { sessionId: "lead", title: "[任务] 流程与文档零散", isRunning: false, startedBy: "ctl" },
      { sessionId: "t1", title: "[D84.1] 时好时坏的固定等待改成轮询", isRunning: true, startedBy: "lead" },
      { sessionId: "t2", title: "[D82] 体检存量测试", isRunning: false, marker: "↩", ask: "等你选快照策略", startedBy: "lead" },
      { sessionId: "lost", title: "[F9] 没有父会话", isRunning: false, marker: "✓" },
    ],
    mergedPrs: [
      { number: 711, title: "D85.2 motion tokens", mergedAt: "2026-11-16T12:25:00Z" },
      { number: 600, title: "yesterday's batch", mergedAt: "2026-11-15T22:00:00Z" },
    ],
    closedIssues: [{ number: 703, title: "[D85.5] fuyu-motion skill", closedAt: "2026-11-16T12:27:00Z" }],
    ...overrides,
  };
}

test("marker and isRunning decide the status; an explicit status wins", () => {
  assert.equal(deriveStatus({ isRunning: true, marker: "↩" }), "running");
  assert.equal(deriveStatus({ marker: "↩" }), "waiting");
  assert.equal(deriveStatus({ marker: "⋯\n" }), "background");
  assert.equal(deriveStatus({ marker: "✓" }), "done");
  assert.equal(deriveStatus({}), "idle");
  assert.equal(deriveStatus({ status: "waiting", isRunning: true }), "waiting");
});

test("startedBy places tasks under their lead and controller; orphans go to 其他", () => {
  const m = buildModel(data());
  const docs = m.lanes.find((l) => l.ctl.short === "流程与文档");
  assert.ok(docs, "controller lane exists");
  const group = docs.groups.find((g) => g.lead?.short === "流程与文档零散");
  assert.deepEqual(group.tasks.map((t) => t.id), ["D82", "D84.1"], "waiting sorts before running");
  const other = m.lanes.find((l) => l.ctl.synthetic);
  assert.deepEqual(other.members.map((t) => t.id), ["F9"]);
  assert.equal(m.orphans.map((t) => t.id).join(), "C97");
});

test("waiting items: waiting sessions, failing PRs and merged-but-open issues; not passing PRs or unmerged work", () => {
  const m = buildModel(data());
  assert.deepEqual(m.asks.map((a) => a.kind), ["会话", "PR", "issue"]);
  assert.match(m.asks[2].title, /^#650 /);
  assert.equal(m.awaitingMerge, 1);
  assert.match(m.asks[0].title, /^D82 /);
  assert.equal(m.asks[0].from, "流程与文档零散 · 流程与文档");
  assert.ok(!m.asks.some((a) => a.title.includes("#713")));
  assert.equal(m.testItem.title, "1 项等你实测");
});

test("only today's merges count, by the report's time zone", () => {
  const m = buildModel(data());
  assert.deepEqual(m.merged.map((p) => p.number), [711]);
  const tokyo = buildModel(data({ tz: "Asia/Tokyo" }));
  assert.deepEqual(tokyo.merged.map((p) => p.number).sort(), [600, 711]);
});

test("the page carries every view and the key content", () => {
  const html = renderReport(data());
  for (const id of ["v-a", "v-b", "v-c"]) assert.ok(html.includes(`id="${id}"`), id);
  for (const text of ["等你选快照策略", "D84.1", "D82", "#711", "#712", "#650", '<span class="a-hold-n">3</span><b>件事在等你</b>', "等你处理 · HOLD"]) assert.ok(html.includes(text), text);
  assert.ok(!html.includes("yesterday&#39;s batch"), "yesterday's merge is not in today's list");
  assert.ok(!/<link\b|<img\b|\bsrc=["']?https?:|@import|url\(\s*["']?https?:/i.test(html), "no external resources");
});

test("text from sessions and PRs is escaped", () => {
  const evil = "</script><img src=x onerror=alert(1)>";
  const page = renderReport(data({
    sessions: [{ sessionId: "x", title: `[X1] ${evil}`, marker: "↩", ask: `"${evil}'` }],
    mergedPrs: [{ number: 711, title: evil, mergedAt: "2026-11-16T12:25:00Z" }],
  }));
  assert.ok(!page.includes("<img"), "no raw tag");
  assert.equal(page.match(/<script>/g).length, 1, "only the page's own script");
  assert.equal(page.match(/<\/script>/g).length, 1);
  assert.ok(page.includes("&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;"));
  assert.ok(page.includes("&quot;&lt;/script&gt;"));
});

test("CLI reads separate files, writes the page and prints its path", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "progress-html-"));
  try {
    const d = data();
    const files = {};
    for (const [key, value] of Object.entries({ progress: d.progress, sessions: d.sessions, prs: d.mergedPrs })) {
      files[key] = path.join(dir, `${key}.json`);
      writeFileSync(files[key], JSON.stringify(value));
    }
    const out = path.join(dir, "out", "report.html");
    const log = console.log;
    const printed = [];
    console.log = (line) => printed.push(line);
    try {
      main(["--progress", files.progress, "--sessions", files.sessions, "--prs", files.prs, "--out", out]);
    } finally {
      console.log = log;
    }
    assert.deepEqual(printed, [out]);
    assert.ok(readFileSync(out, "utf8").includes("等你选快照策略"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("arguments: data is required, default output goes under ai-guide/progress", () => {
  assert.throws(() => parseArgs([]), /缺数据/);
  assert.throws(() => parseArgs(["--out"]), /缺文件/);
  assert.throws(() => parseArgs(["a.json", "b.json"]), /多给了/);
  const out = defaultOut(new Date(2026, 10, 16, 9, 5, 7), "/repo");
  assert.equal(out, path.join("/repo", "ai-guide", "progress", "2026-11-16-090507.html"));
});
