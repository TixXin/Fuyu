import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { land } from "../../scripts/mq/land.mjs";
import { tryCi } from "../../scripts/mq/try.mjs";

const git = (args, cwd) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

async function inTempRepo(prefix, work) {
  const saved = Object.keys(process.env).filter((name) => name.startsWith("GIT_")).map((name) => [name, process.env[name]]);
  for (const [name] of saved) delete process.env[name];
  const cwd = process.cwd();
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), prefix)));
  const remote = path.join(root, "remote.git");
  const main = path.join(root, "app");
  const original = { log: console.log, error: console.error };
  const said = [];
  try {
    git(["init", "-q", "--bare", "-b", "main", remote], root);
    git(["clone", "-q", remote, main], root);
    assert.ok(path.resolve(main, git(["rev-parse", "--git-dir"], main)).startsWith(root + path.sep), "git must run in the temp repo");
    commit(main, "a.txt", "one");
    git(["push", "-q", "origin", "main"], main);
    process.chdir(main);
    console.log = (...args) => said.push(args.join(" "));
    console.error = (...args) => said.push(args.join(" "));
    await work({ remote, main, said: () => said.join("\n") });
  } finally {
    Object.assign(console, original);
    process.chdir(cwd);
    for (const [name, value] of saved) process.env[name] = value;
    try {
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch {
      console.warn(`could not remove ${root}`);
    }
  }
}

function commit(cwd, file, message) {
  writeFileSync(path.join(cwd, file), `${message}\n`);
  git(["add", file], cwd);
  git(["commit", "-q", "-m", message], cwd);
  return git(["rev-parse", "HEAD"], cwd);
}

function remoteBranches(remote, prefix) {
  return git(["for-each-ref", "--format=%(refname:short)", `refs/heads/${prefix}`], remote).split("\n").filter(Boolean).sort();
}

test("land closes this machine's older land PRs whose commits the new PR already carries, says so in the new PR, and leaves every other PR alone (F59)", () => inTempRepo("mq-supersede-", async ({ remote, main, said }) => {
  const contained = commit(main, "b.txt", "first batch");
  const tree = git(["rev-parse", "HEAD^{tree}"], main);
  const other = path.join(path.dirname(remote), "other");
  git(["clone", "-q", remote, other], path.dirname(remote));
  commit(other, "d.txt", "someone else landed");
  git(["push", "-q", "origin", "main"], other);
  git(["fetch", "-q", "origin", "main"], main);
  const mergedEarlier = git(["commit-tree", tree, "-p", contained, "-p", "origin/main", "-m", "earlier in-repo merge"], main);
  const sideways = git(["commit-tree", tree, "-p", "HEAD~1", "-m", "only on the old PR"], main);
  commit(main, "c.txt", "second batch");
  const own = "land/tester/test-pc-main";
  const calls = { created: [], closed: [], bodies: [] };
  let body = "";
  const open = () => [
    { number: 3, headRefName: `${own}-upto-${contained.slice(0, 7)}`, headRefOid: contained },
    { number: 4, headRefName: "land/tester/old-mac-main", headRefOid: mergedEarlier },
    { number: 5, headRefName: `${own}-upto-${sideways.slice(0, 7)}`, headRefOid: sideways },
    { number: 6, headRefName: "land/tester/test-pc-mini-main", headRefOid: contained },
    { number: 7, headRefName: "land/someone/test-pc-main", headRefOid: contained },
    { number: 8, headRefName: "feature/x", headRefOid: contained },
    { number: 9, headRefName: own, headRefOid: git(["rev-parse", own], remote) },
  ];
  const github = {
    login: () => "tester",
    findPr: () => null,
    createPr: (pr) => {
      calls.created.push(pr);
      body = pr.body;
      return { number: 9, url: "https://example.invalid/pull/9" };
    },
    editPr: () => {},
    autoMerge: () => {},
    openPrHeads: open,
    closePr: (number, comment) => calls.closed.push({ number, comment }),
    prBody: () => body,
    setBody: (number, text) => {
      calls.bodies.push(number);
      body = text;
    },
  };

  assert.equal(await land({ github, host: "Test-PC", aliases: ["old-mac"] }), 0);
  assert.equal(calls.created.length, 1);
  assert.deepEqual(calls.closed.map(({ number }) => number), [3, 4], "only this machine's PRs (also under its earlier name) whose commits are all in the new one, an earlier in-repo merge of main included");
  assert.match(calls.closed[0].comment, /#9/);
  assert.deepEqual(calls.bodies, [9]);
  assert.match(body, /取代 #3、#4/);
  assert.match(body, /- `first batch`/, "the PR text land wrote is kept");
  const output = said();
  assert.match(output, /#5（.*）有新 PR 里没有的提交，没关/, "an own PR with commits the new one lacks stays open");
  assert.match(output, /#6（land\/tester\/test-pc-mini-main）不是本机的 land 分支/, "a machine whose name starts like ours is another machine");
  assert.match(output, /#7（land\/someone\/test-pc-main）不是本机的 land 分支/);
  assert.doesNotMatch(output, /\[land\] #[89]（/, "non-land PRs and the new PR itself are not mentioned");
}));

test("try --wait deletes its branch once CI has a result, and keeps it when the run never showed up (F59)", () => inTempRepo("mq-try-wait-", async ({ remote, main }) => {
  commit(main, "b.txt", "local work");
  const github = { login: () => "tester" };
  const branch = "try/tester/test-pc-main";
  const watched = [];
  const watch = (name, sha) => {
    watched.push([name, remoteBranches(remote, "try/"), sha === git(["rev-parse", name], remote)]);
    return { found: true, status: 1 };
  };
  assert.equal(tryCi({ github, host: "Test-PC", wait: true, watch }), 1, "the CI result is still the exit code");
  assert.deepEqual(watched, [[branch, [branch], true]], "CI was watched on the pushed branch");
  assert.deepEqual(remoteBranches(remote, "try/"), [], "and the branch is gone afterwards");

  assert.equal(tryCi({ github, host: "Test-PC", wait: true, watch: () => ({ found: false, status: 1 }) }), 1);
  assert.deepEqual(remoteBranches(remote, "try/"), [branch], "without a run to look at, the branch stays for later");
}));

test("try --clean deletes only this machine's try branches whose CI has finished (F59)", () => inTempRepo("mq-try-clean-", async ({ remote, main, said }) => {
  const head = git(["rev-parse", "HEAD"], main);
  const names = ["try/tester/test-pc-main", "try/tester/old-mac-main", "try/tester/older-mac-main", "try/tester/test-pc-mini-main", "try/tester/win-pc-main", "try/fix-x", "try/someone/test-pc-main"];
  for (const name of names) git(["push", "-q", "origin", `HEAD:refs/heads/${name}`], main);
  const done = [{ headSha: head, status: "completed", conclusion: "failure" }];
  const runs = {
    "try/tester/test-pc-main": [{ headSha: "0123abc", status: "in_progress" }, ...done],
    "try/tester/old-mac-main": [{ headSha: head, status: "in_progress" }],
    "try/tester/older-mac-main": [{ headSha: "0123abc", status: "completed" }],
  };
  const github = { login: () => "tester", runs: (name) => runs[name] ?? done };

  assert.equal(tryCi({ github, host: "Test-PC", aliases: ["old-mac", "older-mac"], clean: true }), 0);
  assert.deepEqual(remoteBranches(remote, "try/"), names.filter((name) => name !== "try/tester/test-pc-main").sort());
  const output = said();
  assert.match(output, /留着 try\/fix-x：别的机器的或手推的/);
  assert.match(output, /留着 try\/tester\/test-pc-mini-main：别的机器的或手推的/);
  assert.match(output, /留着 try\/tester\/old-mac-main：CI 还在跑/, "this machine's branch under its earlier name, still running");
  assert.match(output, /留着 try\/tester\/older-mac-main：没找到这次推送的 CI 记录/, "a finished run for an older push does not count");
}));
