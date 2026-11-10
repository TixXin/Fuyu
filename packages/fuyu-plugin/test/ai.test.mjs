// `fuyu-plugin skill`: the AI assistant skill goes into a plugin folder, files the
// user changed are kept, and the zip leaves it all out.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { aiFiles, AI_IGNORE_LINES, installAi, SKILL_DIR } from "../src/ai.mjs";
import { main } from "../src/cli.mjs";
import { packageFiles } from "../src/pack.mjs";

const workDir = mkdtempSync(path.join(os.tmpdir(), "fuyu-ai-"));
after(() => rmSync(workDir, { recursive: true, force: true }));

test("the skill has SKILL.md with its name and AGENTS.md", () => {
  const files = aiFiles();
  const skill = files.get(`${SKILL_DIR}/SKILL.md`);
  assert.match(skill, /^---\nname: fuyu-plugin\ndescription: .+\n---\n/);
  assert.ok(files.has("AGENTS.md"));
  // Every reference SKILL.md links to is in the skill.
  for (const [, link] of skill.matchAll(/\]\((references\/[^)#]+)/g)) assert.ok(files.has(`${SKILL_DIR}/${link}`), link);
});

test("installing adds the files once, keeps changed ones, and --force replaces them", () => {
  const dir = path.join(workDir, "me.one");
  rmSync(dir, { recursive: true, force: true });
  const first = installAi(dir);
  assert.ok(first.results.every((item) => item.result === "added"));
  assert.equal(first.ignoreFile, ".fuyuignore");
  assert.ok(installAi(dir).results.every((item) => item.result === "unchanged"));

  writeFileSync(path.join(dir, "AGENTS.md"), "my own notes\n");
  const kept = installAi(dir).results.find((item) => item.file === "AGENTS.md");
  assert.equal(kept.result, "kept");
  assert.equal(readFileSync(path.join(dir, "AGENTS.md"), "utf8"), "my own notes\n");
  assert.equal(installAi(dir, { force: true }).results.find((item) => item.file === "AGENTS.md").result, "updated");
  assert.equal(readFileSync(path.join(dir, "AGENTS.md"), "utf8"), aiFiles().get("AGENTS.md"));
});

test("an existing ignore file gets only the missing lines, and the zip leaves the files out", () => {
  const dir = path.join(workDir, "me.two");
  rmSync(dir, { recursive: true, force: true });
  installAi(dir);
  writeFileSync(path.join(dir, ".fuyuignore"), "test/\n.claude/\n");
  writeFileSync(path.join(dir, "fuyu-plugin.json"), "{}");
  installAi(dir);
  const ignore = readFileSync(path.join(dir, ".fuyuignore"), "utf8").split("\n");
  for (const line of AI_IGNORE_LINES) assert.equal(ignore.filter((item) => item === line).length, 1, line);
  const packed = packageFiles(dir).map(([name]) => name);
  // Only the manifest (pack adds its copy under the old name for older islands).
  assert.deepEqual(packed, ["fuyu-plugin.json", "focusd-plugin.json"]);
});

test("the command needs a plugin folder", async () => {
  const lines = [];
  const original = { log: console.log, error: console.error };
  console.log = (line) => lines.push(line);
  console.error = (line) => lines.push(line);
  try {
    const empty = mkdtempSync(path.join(workDir, "empty-"));
    assert.equal(await main(["skill", empty]), 1);
    writeFileSync(path.join(empty, "fuyu-plugin.json"), "{}");
    assert.equal(await main(["skill", empty]), 0);
  } finally {
    Object.assign(console, original);
  }
  assert.ok(lines.some((line) => /no fuyu-plugin\.json/.test(line)));
  assert.ok(lines.some((line) => line.startsWith("added") && line.includes("SKILL.md")));
});
