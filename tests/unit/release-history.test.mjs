import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { compareVersions, historyNoteLines, parseVersion, releaseGroups, versionOfNotePath } from "../../src/features/updater/releaseHistory.ts";
import { parseAddedDates, parseTagDates } from "../../scripts/vite/release-dates.mjs";

const entry = (version, date = null) => ({ version, date });
const order = (versions) => versions.map((value) => parseVersion(value)).sort(compareVersions).map((value) => `${value.major}.${value.minor}.${value.patch}${value.beta === null ? "" : `-beta.${value.beta}`}`);

test("versions sort numerically and a beta comes before its release", () => {
  assert.deepEqual(order(["0.3.10", "0.3.9", "0.3.9-beta.10", "0.3.9-beta.2", "0.2.14", "0.3.10-beta.1"]), [
    "0.2.14", "0.3.9-beta.2", "0.3.9-beta.10", "0.3.9", "0.3.10-beta.1", "0.3.10",
  ]);
  assert.equal(parseVersion("v0.3.9-beta.3")?.beta, 3);
  assert.equal(parseVersion("draft-p6"), null);
  assert.equal(parseVersion(""), null);
});

test("note paths give versions and skip the README and drafts", () => {
  assert.equal(versionOfNotePath("/docs/releases/v0.3.9-beta.1.md"), "0.3.9-beta.1");
  assert.equal(versionOfNotePath("/docs/releases/v0.2.6.md"), "0.2.6");
  assert.equal(versionOfNotePath("/docs/releases/README.md"), null);
  assert.equal(versionOfNotePath("/docs/releases/draft-p6-todos-json.md"), null);
});

test("groups go newest first, fold betas under their release and stop at the current version", () => {
  const entries = ["0.3.8", "0.3.9-beta.1", "0.3.9", "0.3.9-beta.2", "0.3.10-beta.1", "0.3.10-beta.2", "0.3.10", "0.4.0-beta.1"].map((version) => entry(version));
  const groups = releaseGroups(entries, "0.3.10-beta.2");
  assert.deepEqual(groups.map((group) => [group.base, group.stable?.version ?? null, group.betas.map((beta) => beta.version)]), [
    ["0.3.10", null, ["0.3.10-beta.2", "0.3.10-beta.1"]],
    ["0.3.9", "0.3.9", ["0.3.9-beta.2", "0.3.9-beta.1"]],
    ["0.3.8", "0.3.8", []],
  ]);
  assert.equal(releaseGroups(entries, "").length, 4);
  assert.equal(releaseGroups(entries, "0.3.9")[0].base, "0.3.9");
});

test("history notes keep only the changes in the interface language", () => {
  const notes = readFileSync(new URL("../../docs/releases/v0.3.9-beta.1.md", import.meta.url), "utf8");
  const zh = historyNoteLines(notes, "zh-CN");
  const en = historyNoteLines(notes, "en");
  assert.equal(zh[0].kind, "item");
  assert.match(zh[0].text, /^分别保持深色/);
  assert.equal(en[0].kind, "item");
  assert.match(en[0].text, /dark/i);
  for (const lines of [zh, en]) {
    assert.ok(!lines.some((line) => /关于这个版本|About this release|Downloads|ghfast|\.exe/.test(line.text)));
  }
});

test("old notes drop their download section in both languages", () => {
  const notes = readFileSync(new URL("../../docs/releases/v0.2.14.md", import.meta.url), "utf8");
  for (const locale of ["zh-CN", "en"]) {
    const lines = historyNoteLines(notes, locale);
    assert.ok(lines.length > 0);
    assert.ok(!lines.some((line) => line.kind === "heading" && /下载|downloads|更新内容|what's new/i.test(line.text)));
  }
});

test("release dates come from tags first and from when the notes were added", () => {
  assert.deepEqual(parseTagDates("v0.3.9 2026-11-15\nv0.3.9-beta.1 2026-11-14\nnot-a-tag 2026-01-01\n"), { "0.3.9": "2026-11-15", "0.3.9-beta.1": "2026-11-14" });
  const log = "@2026-11-15\n\ndocs/releases/v0.3.9.md\n@2026-11-10\n\ndocs/releases/v0.3.8.md\ndocs/releases/README.md\n@2026-11-01\n\ndocs/releases/v0.3.8.md\n";
  assert.deepEqual(parseAddedDates(log), { "0.3.9": "2026-11-15", "0.3.8": "2026-11-01" });
});
