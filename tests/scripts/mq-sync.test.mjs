import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { land } from "../../scripts/mq/land.mjs";
import { landRequest } from "../../scripts/mq/mq.mjs";
import { sync } from "../../scripts/mq/sync.mjs";
import { tryBranchName } from "../../scripts/mq/try.mjs";

const git = (args, cwd) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const lines = (n, change = {}) => Array.from({ length: n }, (_, i) => change[i] ?? `line ${i}`).join("\n") + "\n";

async function quietly(work) {
  const original = { log: console.log, error: console.error };
  const said = [];
  console.log = (...args) => said.push(args.join(" "));
  console.error = (...args) => said.push(args.join(" "));
  try {
    await work();
  } finally {
    Object.assign(console, original);
  }
  return said.join("\n");
}

async function inRepos(work) {
  const saved = Object.keys(process.env).filter((name) => name.startsWith("GIT_")).map((name) => [name, process.env[name]]);
  for (const [name] of saved) delete process.env[name];
  const cwd = process.cwd();
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "mq-sync-")));
  const remote = path.join(root, "remote.git");
  const main = path.join(root, "app");
  const other = path.join(root, "other");
  const commit = (dir, file, text, message) => {
    writeFileSync(path.join(dir, file), text);
    git(["add", file], dir);
    git(["commit", "-q", "-m", message], dir);
    return git(["rev-parse", "HEAD"], dir);
  };
  try {
    git(["init", "-q", "--bare", "-b", "main", remote], root);
    git(["clone", "-q", remote, main], root);
    commit(main, "f.txt", lines(10), "base");
    git(["push", "-q", "origin", "main"], main);
    git(["clone", "-q", remote, other], root);
    process.chdir(main);
    await work({ remote, main, other, commit });
  } finally {
    process.chdir(cwd);
    for (const [name, value] of saved) process.env[name] = value;
    rmSync(root, { recursive: true, force: true });
  }
}

test("sync brings local main up even when another session's uncommitted file is in the way, keeping its edit on top", () => inRepos(async ({ main, other, commit }) => {
  commit(main, "mine.txt", "mine\n", "local work");
  commit(other, "f.txt", lines(10, { 1: "origin changed line 1" }), "origin edits f");
  commit(other, "g.txt", "g\n", "origin adds g");
  git(["push", "-q", "origin", "main"], other);
  writeFileSync(path.join(main, "f.txt"), lines(10, { 8: "another session is editing line 8" }));
  const said = await quietly(() => sync(main));
  assert.match(said, /merged around 1 uncommitted file/);
  assert.equal(git(["rev-list", "--count", "HEAD..origin/main"], main), "0", "local main has everything from origin");
  assert.equal(git(["rev-list", "--count", "origin/main..HEAD", "--no-merges"], main), "1", "and keeps its own commit");
  assert.equal(readFileSync(path.join(main, "f.txt"), "utf8"), lines(10, { 1: "origin changed line 1", 8: "another session is editing line 8" }));
  assert.equal(git(["status", "--porcelain"], main), "M f.txt", "only the other session's edit is left uncommitted, g.txt is checked out");
  assert.match(git(["diff", "f.txt"], main), /\+another session is editing line 8/);
  assert.doesNotMatch(git(["diff", "f.txt"], main), /origin changed line 1/);
}));

test("sync fast-forwards around an uncommitted file too, and stops without touching anything when the edits overlap", () => inRepos(async ({ main, other, commit }) => {
  commit(other, "f.txt", lines(10, { 2: "origin" }), "origin edits line 2");
  git(["push", "-q", "origin", "main"], other);
  writeFileSync(path.join(main, "f.txt"), lines(10, { 6: "mine" }));
  await quietly(() => sync(main));
  assert.equal(git(["rev-parse", "HEAD"], main), git(["rev-parse", "origin/main"], main), "a plain fast-forward, no merge commit");
  assert.equal(readFileSync(path.join(main, "f.txt"), "utf8"), lines(10, { 2: "origin", 6: "mine" }));

  commit(other, "f.txt", lines(10, { 2: "origin", 6: "origin again" }), "origin edits line 6");
  git(["push", "-q", "origin", "main"], other);
  const before = git(["rev-parse", "HEAD"], main);
  const said = await quietly(() => sync(main));
  assert.match(said, /f\.txt: 没提交的改动和 origin\/main 改了同一处/);
  assert.equal(git(["rev-parse", "HEAD"], main), before);
  assert.equal(readFileSync(path.join(main, "f.txt"), "utf8"), lines(10, { 2: "origin", 6: "mine" }));
}));

test("land --upto carries local main up to a commit with the same commit ids, and leaves later commits and the work tree alone", () => inRepos(async ({ remote, main, other, commit }) => {
  const theirs = commit(main, "a.txt", "a\n", "another session's commit");
  const mine = commit(main, "b.txt", "b\n", "my task");
  commit(main, "c.txt", "c\n", "not ready yet");
  commit(other, "o.txt", "o\n", "someone else landed");
  git(["push", "-q", "origin", "main"], other);
  writeFileSync(path.join(main, "f.txt"), "uncommitted\n");
  const head = git(["rev-parse", "HEAD"], main);
  const created = [];
  const gh = { login: () => "tester", findPr: () => null, createPr: (pr) => (created.push(pr), { number: 9, url: "u" }), editPr: () => {}, autoMerge: () => {} };
  const branch = `land/tester/test-pc-main-upto-${mine.slice(0, 7)}`;
  await quietly(async () => assert.equal(await land({ github: gh, host: "Test-PC", upto: mine.slice(0, 8) }), 0));
  for (const sha of [theirs, mine]) assert.doesNotThrow(() => git(["merge-base", "--is-ancestor", sha, branch], remote), "the same commits, not copies");
  assert.equal(git(["log", "--format=%s", branch], remote).includes("not ready yet"), false);
  assert.equal(git(["rev-parse", "HEAD"], main), head, "local main did not move");
  assert.equal(git(["status", "--porcelain"], main), "M f.txt");
  assert.equal(created[0].head, branch);
  assert.match(await quietly(async () => assert.equal(await land({ github: gh, host: "Test-PC", upto: "nope" }), 1)), /找不到提交 nope/);
  const onMain = git(["rev-parse", "origin/main~1"], main);
  assert.match(await quietly(async () => assert.equal(await land({ github: gh, host: "Test-PC", upto: onMain }), 1)), /已经在 origin\/main 上/);
}));

test("--only needs --urgent now, --upto takes one commit, and try branches sit beside land branches", () => {
  assert.match(landRequest(["--yes", "--only", "a1"]).error, /--upto/);
  assert.deepEqual(landRequest(["--yes", "--only", "a1", "--urgent"]).options.only, ["a1"]);
  assert.equal(landRequest(["--yes", "--upto", "a1"]).options.upto, "a1");
  assert.match(landRequest(["--yes", "--upto"]).error, /--upto 后面要写提交号/);
  assert.match(landRequest(["--yes", "--upto", "a1", "--only", "b2", "--urgent"]).error, /只能用一个/);
  assert.equal(tryBranchName("TixXin", "TixxindeMacBook-Air.local", "main"), "try/TixXin/tixxindemacbook-air-main");
});
