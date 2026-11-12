// The lane pool lives in patches/claude-code-merge-queue@0.7.1.patch (dist/lib/lane-pool.js);
// this fails if an upgrade of the package drops it.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

// Not in the package's exports, so by file path.
const poolFile = path.join(fileURLToPath(new URL("../..", import.meta.url)), "node_modules", "claude-code-merge-queue", "dist", "lib", "lane-pool.js");
const { laneOf, reuseIdleLane } = await import(pathToFileURL(poolFile).href);

const cfg = { worktreeSuffix: "-lanes/", branchPrefix: "lane/" };

test("a session gets its own idle lane back, and never someone else's or one with work", () => {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "lane-pool-")));
  const main = path.join(root, "app");
  const lane = (n) => path.join(root, "app-lanes", String(n));
  const git = (args, cwd = main) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const before = process.cwd();
  // land runs the checks from git's pre-push hook, whose GIT_DIR and friends would point
  // every git call here (the pool's too) at the real repo: once that re-initialised it as
  // bare and committed to it.
  const hookEnv = Object.keys(process.env).filter((name) => name.startsWith("GIT_")).map((name) => [name, process.env[name]]);
  for (const [name] of hookEnv) delete process.env[name];
  try {
    mkdirSync(main);
    git(["init", "-q", "-b", "main"]);
    const gitDir = path.resolve(main, git(["rev-parse", "--git-dir"]));
    assert.ok(gitDir.startsWith(root + path.sep), `git must run in the temp repo, not ${gitDir}`);
    git(["commit", "-q", "--allow-empty", "-m", "one"]);
    for (const n of [1, 2, 3]) git(["worktree", "add", "-q", lane(n), "-b", `lane/${n}`]);
    process.chdir(main);
    // main moves on, as after a land; lane 2 has a file, lane 3 a commit main does not have.
    git(["commit", "-q", "--allow-empty", "-m", "two"]);
    writeFileSync(path.join(lane(2), "wip.txt"), "x");
    git(["commit", "-q", "--allow-empty", "-m", "mine"], lane(3));
    const owners = { 1: 4242, 2: 77, 3: 77 };
    mkdirSync(path.join(gitDir, "claude-code-merge-queue"), { recursive: true });
    writeFileSync(path.join(gitDir, "claude-code-merge-queue", "lane-owners.json"), JSON.stringify(Object.fromEntries(
      Object.entries(owners).map(([n, pid]) => [path.resolve(lane(n)).toLowerCase(), { pid, since: "2026-11-12T00:00:00Z" }]),
    )));

    assert.equal(laneOf(main, cfg, path.join(lane(2), "src")), 2);
    assert.equal(laneOf(main, cfg, main), null);

    assert.equal(reuseIdleLane(main, cfg, main, null), null, "a new session does not take another session's lane");
    assert.equal(reuseIdleLane(main, cfg, main, 9999), null, "nor does a session that owns none");
    assert.equal(reuseIdleLane(main, cfg, main, 77), null, "its own lanes with work are left alone");
    assert.equal(git(["status", "--porcelain"], lane(2)), "?? wip.txt");
    assert.notEqual(git(["rev-parse", "HEAD"], lane(3)), git(["rev-parse", "HEAD"]), "the unlanded commit is still there");

    assert.equal(reuseIdleLane(main, cfg, main, 4242)?.lane, 1, "the same claude.exe gets its idle lane back");
    assert.equal(git(["rev-parse", "HEAD"], lane(1)), git(["rev-parse", "HEAD"]), "reset to main's HEAD");
    assert.equal(git(["rev-parse", "--abbrev-ref", "HEAD"], lane(1)), "lane/1");
    assert.equal(reuseIdleLane(main, cfg, path.join(lane(1), "src"), null)?.lane, 1, "a session already in the lane (after /clear) gets it back");
  } finally {
    process.chdir(before);
    for (const [name, value] of hookEnv) process.env[name] = value;
    rmSync(root, { recursive: true, force: true });
  }
});
