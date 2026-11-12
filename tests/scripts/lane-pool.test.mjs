// The lane pool lives in patches/claude-code-merge-queue@0.7.1.patch (dist/lib/lane-pool.js);
// this fails if an upgrade of the package drops it.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

// Not in the package's exports, so by file path.
const poolFile = path.join(fileURLToPath(new URL("../..", import.meta.url)), "node_modules", "claude-code-merge-queue", "dist", "lib", "lane-pool.js");
const { laneOf, reuseIdleLane } = await import(pathToFileURL(poolFile).href);

const cfg = { worktreeSuffix: "-lanes/", branchPrefix: "lane/" };

test("a new session takes back an idle lane, and never one with work or someone in it", { skip: process.platform !== "win32" }, async () => {
  const root = mkdtempSync(path.join(tmpdir(), "lane-pool-"));
  const main = path.join(root, "app");
  const lane = (n) => path.join(root, "app-lanes", String(n));
  const git = (args, cwd = main) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const before = process.cwd();
  try {
    mkdirSync(main);
    git(["init", "-q", "-b", "main"]);
    git(["commit", "-q", "--allow-empty", "-m", "one"]);
    for (const n of [1, 2, 3]) git(["worktree", "add", "-q", lane(n), "-b", `lane/${n}`]);
    process.chdir(main);
    // main moves on, as after a land; lane 2 has a file, lane 3 a commit main does not have.
    git(["commit", "-q", "--allow-empty", "-m", "two"]);
    writeFileSync(path.join(lane(2), "wip.txt"), "x");
    git(["commit", "-q", "--allow-empty", "-m", "mine"], lane(3));

    assert.equal(laneOf(main, cfg, path.join(lane(2), "src")), 2);
    assert.equal(laneOf(main, cfg, main), null);

    assert.equal(reuseIdleLane(main, cfg, main, null)?.lane, 1, "the clean, landed lane");
    assert.equal(git(["rev-parse", "HEAD"], lane(1)), git(["rev-parse", "HEAD"]), "reset to main's HEAD");
    assert.equal(git(["rev-parse", "--abbrev-ref", "HEAD"], lane(1)), "lane/1");

    const sitter = spawn("ping", ["-n", "30", "127.0.0.1"], { cwd: lane(1), stdio: "ignore", windowsHide: true });
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(reuseIdleLane(main, cfg, main, null), null, "busy, dirty and unlanded lanes are left alone");
    assert.equal(reuseIdleLane(main, cfg, lane(1), null)?.lane, 1, "a session already in the lane (after /clear) gets it back");
    sitter.kill();
    await new Promise((resolve) => sitter.on("exit", resolve));
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(reuseIdleLane(main, cfg, main, null)?.lane, 1, "free again once the process left");
    assert.equal(git(["status", "--porcelain"], lane(2)), "?? wip.txt", "the dirty lane was not touched");
    assert.notEqual(git(["rev-parse", "HEAD"], lane(3)), git(["rev-parse", "HEAD"]), "the unlanded commit is still there");
  } finally {
    process.chdir(before);
    rmSync(root, { recursive: true, force: true });
  }
});
