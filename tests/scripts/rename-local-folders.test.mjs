import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { laneNumber } from "../../scripts/build-dirs.mjs";
import { claudeProjectKey, planRename, rewriteKeys } from "../../scripts/rename-local-folders.mjs";

const script = fileURLToPath(new URL("../../scripts/rename-local-folders.mjs", import.meta.url));

test("Claude Code keeps a project's memory and history under its path with every other character a dash", () => {
  assert.equal(claudeProjectKey(path.join("E:", "Projects", "fly-island")), "E--Projects-fly-island");
  assert.equal(claudeProjectKey(path.join("E:", "Projects", "fuyu-lanes", "3")), "E--Projects-fuyu-lanes-3");
});

test("lane records move to the new folders and keep everything else", () => {
  const main = path.join("E:", "Projects", "fly-island");
  const lanes = path.join("E:", "Projects", "fly-island-lanes");
  const records = { [path.join(lanes, "4").toLowerCase()]: { pid: 1 }, [path.join("E:", "other").toLowerCase()]: { pid: 2 } };
  const moved = rewriteKeys(rewriteKeys(records, lanes, path.join("E:", "Projects", "fuyu-lanes")), main, path.join("E:", "Projects", "fuyu"));
  assert.deepEqual(Object.keys(moved).sort(), [path.join("E:", "Projects", "fuyu-lanes", "4").toLowerCase(), path.join("E:", "other").toLowerCase()].sort());
});

test("lanes are found under any <repo>-lanes folder", () => {
  assert.equal(laneNumber(path.join("E:", "Projects", "fuyu-lanes", "7")), 7);
  assert.equal(laneNumber(path.join("E:", "Projects", "fly-island-lanes", "7")), 7);
  assert.equal(laneNumber(path.join("E:", "Projects", "-lanes", "7")), null);
  assert.equal(laneNumber(path.join("E:", "Projects", "fuyu", "7")), null);
});

test("the rename moves the checkout and its lanes, and git, hooks and lane records follow", () => {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "rename-")));
  const hookEnv = Object.keys(process.env).filter((name) => name.startsWith("GIT_")).map((name) => [name, process.env[name]]);
  for (const [name] of hookEnv) delete process.env[name];
  const main = path.join(root, "old-app");
  const git = (args, cwd = main) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  try {
    mkdirSync(main);
    git(["init", "-q", "-b", "main"]);
    assert.ok(path.resolve(main, git(["rev-parse", "--git-dir"])).startsWith(root + path.sep), "git must run in the temp repo");
    git(["commit", "-q", "--allow-empty", "-m", "one"]);
    git(["config", "core.hooksPath", path.join(main, ".githooks")]);
    git(["worktree", "add", "-q", path.join(root, "old-app-lanes", "2"), "-b", "lane/2"]);
    const queue = path.join(main, ".git", "claude-code-merge-queue");
    mkdirSync(queue, { recursive: true });
    writeFileSync(path.join(queue, "lane-sessions.json"), JSON.stringify({ [path.join(root, "old-app-lanes", "2").toLowerCase()]: { name: "a" } }));
    const claude = path.join(root, "claude-projects");
    mkdirSync(path.join(claude, claudeProjectKey(main), "memory"), { recursive: true });
    writeFileSync(path.join(claude, claudeProjectKey(main), "memory", "MEMORY.md"), "x");

    const plan = planRename({ main, name: "new-app", claudeProjects: claude });
    assert.deepEqual(plan.lanes, ["2"]);
    assert.equal(plan.projects.length, 1);

    const args = [script, main, "--name", "new-app", "--claude-projects", claude];
    assert.match(execFileSync("node", args, { cwd: root, encoding: "utf8" }), /演练/);
    assert.ok(existsSync(main), "a dry run changes nothing");

    execFileSync("node", [...args, "--apply"], { cwd: root, encoding: "utf8", stdio: "pipe" });
    const newMain = path.join(root, "new-app");
    const newLane = path.join(root, "new-app-lanes", "2");
    assert.equal(existsSync(main), false);
    assert.equal(git(["rev-parse", "--abbrev-ref", "HEAD"], newLane), "lane/2", "the lane still works after worktree repair");
    assert.match(git(["worktree", "list"], newMain), /new-app-lanes/);
    assert.equal(path.resolve(git(["config", "core.hooksPath"], newMain)), path.join(newMain, ".githooks"));
    const sessions = JSON.parse(readFileSync(path.join(newMain, ".git", "claude-code-merge-queue", "lane-sessions.json"), "utf8"));
    assert.deepEqual(Object.keys(sessions), [newLane.toLowerCase()]);
    assert.equal(readFileSync(path.join(claude, claudeProjectKey(newMain), "memory", "MEMORY.md"), "utf8"), "x", "memory copied");
    assert.ok(existsSync(path.join(claude, claudeProjectKey(main))), "the old memory stays");
  } finally {
    for (const [name, value] of hookEnv) process.env[name] = value;
    try {
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch {
      console.warn(`could not remove ${root}`);
    }
  }
});
