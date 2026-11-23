import assert from "node:assert/strict";
import test from "node:test";
import { coveragePages, hunkLines, hunkTexts, pageShows, parseHunks, usableTable } from "../../scripts/regression/coverageSelect.mjs";
import { parseRanges } from "../../scripts/regression/coverage.mjs";

const SHA = "a".repeat(40);
const NOW = Date.parse("2026-11-22T12:00:00Z");

function fixture({ diffs = {}, existed = () => true, exists = () => true, texts = {}, imports = () => [] } = {}) {
  const table = {
    sha: SHA,
    at: "2026-11-22T00:00:00Z",
    pages: {
      "a.html": { "src/shell.tsx": "1-3,10", "src/panel.tsx": "1-2", "src/i18n/sections/x.ts": "2-4" },
      "b.html?test=1": { "src/shell.tsx": "1-3", "src/style.css": "*", "src/i18n/sections/x.ts": "2-4" },
    },
    mapped: { "src/shell.tsx": "1-3,8-10", "src/panel.tsx": "1-2,5-6", "src/i18n/sections/x.ts": "2-4" },
  };
  const git = { existedAt: (sha, file) => existed(file), diff: (sha, file) => diffs[file] ?? "" };
  const run = (changed, pages = ["a.html", "b.html?test=1", "c.html"]) => coveragePages({
    changed, pages, table, git, exists, ownFiles: (page) => [`tests/regression/${page.split("?")[0]}`, `tests/regression/${page.split("?")[0].replace(".html", ".tsx")}`],
    importPages: imports, pageText: (page) => texts[page] ?? { snapshot: "", source: "" },
  }).pages;
  return { run };
}

test("a table is usable only while it is recent and its commit is here", () => {
  const table = { sha: SHA, at: "2026-11-20T00:00:00Z", pages: {} };
  assert.equal(usableTable(table, { now: NOW }).table, table);
  assert.match(usableTable({ ...table, at: "2026-10-01T00:00:00Z" }, { now: NOW }).why, /天前/);
  assert.match(usableTable(table, { now: NOW, hasCommit: () => false }).why, /不在本地/);
  assert.match(usableTable(null).why, /还没有/);
});

test("hunks give old line numbers; an insertion or a change to unmapped lines uses the nearest mapped neighbours", () => {
  const hunks = parseHunks("@@ -9 +9 @@\n-a\n+b\n@@ -5,0 +6,2 @@\n+c\n+d\n@@ -6,2 +8 @@\n-e\n-f\n+g\n");
  assert.deepEqual(hunks.map(({ start, count }) => [start, count]), [[9, 1], [5, 0], [6, 2]]);
  const mapped = parseRanges("1-3,8-10");
  assert.deepEqual(hunkLines(hunks[0], mapped), [9]);
  assert.deepEqual(hunkLines(hunks[1], mapped), [3, 8]);
  assert.deepEqual(hunkLines(hunks[2], mapped), [3, 8]);
});

test("a change inside a function picks only the pages that ran that line", () => {
  const { run } = fixture({ diffs: { "src/shell.tsx": "@@ -10 +10 @@\n-x\n+y\n" } });
  assert.deepEqual(run(["src/shell.tsx"]), ["a.html"]);
});

test("a change to top-level lines picks every page that loaded the file, and a whole-file entry always counts", () => {
  const { run } = fixture({ diffs: { "src/shell.tsx": "@@ -2 +2 @@\n-x\n+y\n", "src/style.css": "@@ -40 +40 @@\n-a\n+b\n" } });
  assert.deepEqual(run(["src/shell.tsx"]), ["a.html", "b.html?test=1"]);
  assert.deepEqual(run(["src/style.css"]), ["b.html?test=1"]);
});

test("pages missing from the table and files new since the table fall back to imports", () => {
  const asked = [];
  const { run } = fixture({ existed: (file) => file !== "src/new.ts", imports: (pages, files) => (asked.push([pages, files]), pages.includes("c.html") ? ["c.html"] : ["b.html?test=1"]) });
  assert.deepEqual(run(["src/new.ts"]), ["b.html?test=1", "c.html"]);
  assert.deepEqual(asked, [[["c.html"], ["src/new.ts"]], [["a.html", "b.html?test=1"], ["src/new.ts"]]]);
});

test("a code file no page ran picks nothing, an asset falls back to imports, a deleted file picks its loaders", () => {
  const { run } = fixture({ exists: (file) => file !== "src/panel.tsx", imports: (pages) => (pages.includes("a.html") ? ["a.html"] : []) });
  assert.deepEqual(run(["src/types.ts"]), []);
  assert.deepEqual(run(["src/icon.svg"]), ["a.html"]);
  assert.deepEqual(run(["src/panel.tsx"]), ["a.html"]);
  assert.deepEqual(run(["docs/notes.md", "scripts/tool.mjs"]), []);
});

test("changing a page's own test file picks it even when nothing else does", () => {
  const { run } = fixture();
  assert.deepEqual(run(["tests/regression/b.tsx"]), ["b.html?test=1"]);
});

test("i18n text picks the pages that show the old text, or whose test uses a word of it", () => {
  const diffs = { "src/i18n/sections/x.ts": "@@ -3 +3 @@\n-  nothing: \"没有日程\",\n+  nothing: \"今天没有日程\",\n" };
  const texts = { "a.html": { snapshot: "<p>没有日程</p>", source: "" }, "b.html?test=1": { snapshot: "<p>别的</p>", source: "" } };
  assert.deepEqual(fixture({ diffs, texts }).run(["src/i18n/sections/x.ts"]), ["a.html"]);
  const keywords = { "src/i18n/sections/x.ts": "@@ -3 +3 @@\n-  reminders: \"待办 提醒 音效\",\n+  reminders: \"待办 提醒\",\n" };
  const typed = { "b.html?test=1": { snapshot: "", source: "await type(\"音效\");" } };
  assert.deepEqual(fixture({ diffs: keywords, texts: typed }).run(["src/i18n/sections/x.ts"]), ["b.html?test=1"]);
});

test("i18n lines that are not plain key: text fall back to line coverage", () => {
  assert.equal(hunkTexts({ removed: ["  weekdays: ZH_WEEKDAYS,"], added: ["  weekdays: EN_WEEKDAYS,"] }), null);
  assert.equal(hunkTexts({ removed: ["    `${n} 项`,"], added: [] }), null);
  assert.deepEqual([...hunkTexts({ removed: ["  title: string;", "  title: \"日历\","], added: [] })], ["日历"]);
  const diffs = { "src/i18n/sections/x.ts": "@@ -3 +3 @@\n-  weekdays: ZH,\n+  weekdays: EN,\n" };
  assert.deepEqual(fixture({ diffs }).run(["src/i18n/sections/x.ts"]), ["a.html", "b.html?test=1"]);
});

test("text matching follows HTML escaping, and a word counts only as a whole string in the test", () => {
  assert.ok(pageShows({ snapshot: "<button title=\"Say &quot;hi&quot;\">", source: "" }, new Set(["Say \"hi\""])));
  assert.ok(!pageShows({ snapshot: "", source: "check(ok, \"Nothing happens when the day ends\");" }, new Set(["Nothing scheduled"])));
  assert.ok(pageShows({ snapshot: "", source: "await type(\"reminders\");" }, new Set(["todos reminders"])));
});
