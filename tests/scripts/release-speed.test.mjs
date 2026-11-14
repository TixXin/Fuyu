import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { RELEASED_MARKER, tellIssues } from "../../scripts/release/after-release.mjs";
import { betaTags, mergeBetaNotes, sectionItems } from "../../scripts/release/beta-notes.mjs";
import { draftNotes } from "../../scripts/release/notes-draft.mjs";
import { matchingPrebuild, readPrebuild } from "../../scripts/release/prebuild.mjs";

const notes = (zh, en) => `## 关于这个版本\n\nx\n\n## 更新内容\n\n${zh}\n\n---\n\n## About this release\n\ny\n\n## What's New\n\n${en}\n\n## Downloads\n\n- a\n`;

const beta2 = notes(
  "- **计时器**：新的。\n- **修复**：\n  - 二号修复。",
  "- **Timer**: new.\n- **Fixes**:\n  - Fix two.",
);
const beta1 = notes(
  "- **长截图**：第一行\n  续行。\n- **修复**：\n  - 一号修复。",
  "- **Long screenshots**: first line\n  more.\n- **Fixes**:\n  - Fix one.",
);

test("only this version's betas count, newest first", () => {
  const tags = ["v0.3.7", "v0.3.8-beta.1", "v0.3.8-beta.10", "v0.3.8-beta.2", "v0.3.9-beta.1", "v0.3.8"];
  assert.deepEqual(betaTags("0.3.8", tags), ["v0.3.8-beta.10", "v0.3.8-beta.2", "v0.3.8-beta.1"]);
});

test("an entry keeps its wrapped lines and the section ends where the next one starts", () => {
  assert.deepEqual(sectionItems(beta1, "zh"), ["- **长截图**：第一行\n  续行。", "- **修复**：\n  - 一号修复。"]);
  assert.deepEqual(sectionItems(beta1.replace(/\n/g, "\r\n"), "en")[0], "- **Long screenshots**: first line\n  more.");
  assert.deepEqual(sectionItems(notes("-", "-"), "zh"), []);
});

test("the betas' changes are merged with every fix in one group at the end", () => {
  const merged = mergeBetaNotes([beta2, beta1]);
  assert.equal(merged.zh, "- **计时器**：新的。\n- **长截图**：第一行\n  续行。\n- **修复**：\n  - 二号修复。\n  - 一号修复。");
  assert.equal(merged.en, "- **Timer**: new.\n- **Long screenshots**: first line\n  more.\n- **Fixes**:\n  - Fix two.\n  - Fix one.");
  assert.equal(mergeBetaNotes([]), null);
});

test("a final release's draft starts from the merged notes and lists commits after the last beta", () => {
  const merged = mergeBetaNotes([beta2, beta1]);
  const draft = draftNotes("0.3.8", "v0.3.7", [{ hash: "a1", subject: "fix: late" }], merged, "v0.3.8-beta.2");
  assert.ok(draft.includes(`## 更新内容\n\n${merged.zh}\n`) && draft.includes(`## What's New\n\n${merged.en}\n`));
  assert.ok(draft.includes("Commits since v0.3.8-beta.2") && draft.includes("包含 v0.3.7 以来的全部改动"));
  assert.ok(draftNotes("0.3.8", "v0.3.7", []).includes("## 更新内容\n\n-\n"));
});

test("a prebuild is used only for the same version and the same files", () => {
  const record = { version: "0.3.9", tree: "t1", revision: "r1", windows: 11, mac: 12 };
  assert.equal(matchingPrebuild(record, { version: "0.3.9", tree: "t1" }), record);
  assert.equal(matchingPrebuild(record, { version: "0.3.9", tree: "t2" }), null);
  assert.equal(matchingPrebuild(record, { version: "0.3.10", tree: "t1" }), null);
  assert.equal(matchingPrebuild({ ...record, windows: undefined }, { version: "0.3.9", tree: "t1" }), null);
  assert.equal(matchingPrebuild(null, { version: "0.3.9", tree: "t1" }), null);
  const dir = mkdtempSync(join(tmpdir(), "fuyu-prebuild-"));
  writeFileSync(join(dir, "broken.json"), "{");
  assert.equal(readPrebuild(join(dir, "broken.json")), null);
  assert.equal(readPrebuild(join(dir, "missing.json")), null);
});

test("issues are told a few at a time, in order, and once per release", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fuyu-tell-"));
  let open = 0;
  let most = 0;
  const posted = [];
  const gh = async (args) => {
    open += 1;
    most = Math.max(most, open);
    await new Promise((resolve) => setTimeout(resolve, 5));
    open -= 1;
    if (args[0] === "api") return { status: 0, stdout: args[1].includes("/3/") ? RELEASED_MARKER("v1.0.0") : "", stderr: "" };
    posted.push(args[2]);
    return { status: args[2] === "5" ? 1 : 0, stdout: "", stderr: "boom" };
  };
  const shipped = new Map([1, 2, 3, 4, 5, 6, 7, 8].map((issue) => [issue, [{ id: `T${issue}`, path: `docs/tasks/T${issue}.md` }]]));
  const lines = await tellIssues(shipped, { tag: "v1.0.0", url: "u", repo: "o/r", dir, gh, limit: 3 });
  assert.ok(most <= 3 && most > 1);
  assert.ok(!posted.includes("3"));
  assert.equal(lines.length, 7);
  assert.match(lines[0], /#1 that it shipped/);
  assert.match(lines[3], /#5: the comment failed: boom/);
});
