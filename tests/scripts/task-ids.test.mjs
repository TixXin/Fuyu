import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { idsInPaths, idsInTitles, nextId, runGit, usedIds } from "../../scripts/tasks/taskIds.mjs";

const task = (id) => `---\nid: ${id}\ntitle: t ${id}\nstatus: 待做\n---\n\n## 说明\n\nx\n`;

function repo(dir) {
  const run = (...args) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: dir, stdio: "pipe" });
  const write = (id) => {
    mkdirSync(path.join(dir, "docs/tasks", id[0]), { recursive: true });
    writeFileSync(path.join(dir, "docs/tasks", id[0], `${id}.md`), task(id));
  };
  return { run, write };
}

function machines() {
  const base = mkdtempSync(path.join(os.tmpdir(), "task-ids-"));
  const origin = path.join(base, "origin.git");
  const other = path.join(base, "other");
  const here = path.join(base, "here");
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", origin]);
  execFileSync("git", ["clone", "-q", origin, other], { stdio: "pipe" });
  const them = repo(other);
  them.run("symbolic-ref", "HEAD", "refs/heads/main");
  them.write("B3");
  them.run("add", ".");
  them.run("commit", "-qm", "B3");
  them.run("push", "-q", "origin", "main");
  execFileSync("git", ["clone", "-q", origin, here], { stdio: "pipe" });
  repo(here).write("B4");
  them.write("B7");
  them.write("B6.2.3");
  them.run("add", ".");
  them.run("commit", "-qm", "B7");
  them.run("push", "-q", "origin", "HEAD:land/other-machine");
  return { base, here };
}

const noIssues = async () => [];

test("ids are read from task paths and from [X1] in issue titles, skipping the issue being filed", () => {
  assert.deepEqual(idsInPaths("docs/tasks/README.md\r\ndocs/tasks/B/B6.md\ndocs/tasks/0-archive/C/C9b.md\ndocs/tasks/B/B6.2.7.md\n"), ["B6", "C9b", "B6.2.7"]);
  const issues = [{ number: 5, title: "[B62] x" }, { number: 6, title: "no id [later]" }, { number: 7, title: "[F56] y" }];
  assert.deepEqual(idsInTitles(issues, 7), [{ id: "B62", where: "#5" }]);
});

test("the next id is one past the largest seen, per group or per parent", () => {
  const used = new Map(["B6", "B62", "B6.2.7", "B6.2.10", "B6.2.10.1", "C9b"].map((id) => [id, "本地"]));
  assert.equal(nextId("B", used), "B63");
  assert.equal(nextId("B6.2", used), "B6.2.11");
  assert.equal(nextId("C", used), "C10");
  assert.equal(nextId("G", used), "G1");
});

test("ids pushed to a land branch on the other machine count as used", async () => {
  const { base, here } = machines();
  try {
    const warnings = [];
    const used = await usedIds(here, { gh: noIssues, warn: (line) => warnings.push(line) });
    assert.deepEqual(warnings, []);
    assert.equal(used.get("B4"), "本地");
    assert.equal(used.get("B3"), "本地");
    assert.equal(used.get("B7"), "origin/land/other-machine");
    assert.equal(nextId("B", used), "B8");
    assert.equal(nextId("B6.2", used), "B6.2.4");
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("ids in issue titles count as used, so a task not pushed yet still blocks its number", async () => {
  const { base, here } = machines();
  try {
    const calls = [];
    const gh = async (args) => {
      calls.push(args.join(" "));
      return args.includes("open") ? [{ number: 690, title: "[B12] other machine" }] : [{ number: 600, title: "[B9] closed" }];
    };
    const used = await usedIds(here, { gh, warn: () => {} });
    assert.equal(used.get("B12"), "#690");
    assert.equal(used.get("B9"), "#600");
    assert.equal(nextId("B", used), "B13");
    assert.ok(calls.some((call) => call.includes("--state closed --limit 200")));
    const skipping = await usedIds(here, { gh, warn: () => {}, skipIssue: 690 });
    assert.equal(skipping.has("B12"), false);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("a failed fetch or gh only warns and falls back to what is already here", async () => {
  const { base, here } = machines();
  try {
    const warnings = [];
    const git = async (root, args) => {
      if (args[0] === "fetch") throw Object.assign(new Error("fetch"), { stderr: "fatal: unable to access origin\n" });
      return runGit(root, args);
    };
    const gh = async () => {
      throw Object.assign(new Error("gh"), { killed: true });
    };
    const used = await usedIds(here, { git, gh, warn: (line) => warnings.push(line) });
    assert.equal(warnings.length, 2);
    assert.match(warnings[0], /git fetch 失败（fatal: unable to access origin）/);
    assert.match(warnings[1], /GitHub issue（超时）/);
    assert.equal(used.has("B7"), false);
    assert.equal(nextId("B", used), "B5");
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
