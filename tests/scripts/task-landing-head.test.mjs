import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { tasksAt } from "../../scripts/tasks/taskLanding.mjs";

const task = (status) => `---\nid: Z1\ntitle: t\nstatus: ${status}\n---\n\n## 说明\n\nx\n`;

test("the landing check reads task files from the pushed commit, not the shared work tree", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "task-landing-"));
  const git = (...args) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: root, stdio: "pipe" });
  try {
    git("init", "-q");
    mkdirSync(path.join(root, "docs/tasks/Z"), { recursive: true });
    writeFileSync(path.join(root, "docs/tasks/Z/Z1.md"), task("进行中"));
    git("add", ".");
    git("commit", "-qm", "claim");
    writeFileSync(path.join(root, "docs/tasks/Z/Z1.md"), task("已完成"));
    const [found] = tasksAt(root, "HEAD", ["docs/tasks/Z/Z1.md", "docs/tasks/Z/gone.md"]);
    assert.equal(found.fields.status, "进行中");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
