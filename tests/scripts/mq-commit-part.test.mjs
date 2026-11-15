import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { commitBlock, customIndexNote } from "../../scripts/mq/checkCommit.mjs";
import { commitPart, parseArgs } from "../../scripts/mq/commitPart.mjs";
import { applyHunks, buildHunks, parseRanges, splitLines, strayLines } from "../../scripts/mq/hunks.mjs";

const COMMIT_MSG_HOOK = fileURLToPath(new URL("../../.githooks/commit-msg", import.meta.url));
const MQ = fileURLToPath(new URL("../../scripts/mq/mq.mjs", import.meta.url));
const TEN = "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten\n";

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function inTempRepo(work) {
  const saved = Object.keys(process.env).filter((name) => name.startsWith("GIT_")).map((name) => [name, process.env[name]]);
  for (const [name] of saved) delete process.env[name];
  const cwd = process.cwd();
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "mq-commit-part-")));
  try {
    git(["init", "-q", "-b", "main"], root);
    for (const [key, value] of [["user.email", "t@example.com"], ["user.name", "t"], ["commit.gpgsign", "false"], ["core.autocrlf", "false"], ["core.hooksPath", ".githooks"]]) git(["config", key, value], root);
    assert.ok(path.resolve(root, git(["rev-parse", "--git-dir"], root)).startsWith(root + path.sep), "git must run in the temp repo");
    mkdirSync(path.join(root, ".githooks"));
    copyFileSync(COMMIT_MSG_HOOK, path.join(root, ".githooks", "commit-msg"));
    chmodSync(path.join(root, ".githooks", "commit-msg"), 0o755);
    process.chdir(root);
    work(root);
  } finally {
    process.chdir(cwd);
    for (const [name, value] of saved) process.env[name] = value;
    rmSync(root, { recursive: true, force: true });
  }
}

function write(root, file, content) {
  writeFileSync(path.join(root, file), content);
}

function seed(root, files, subject = "base") {
  for (const [file, content] of Object.entries(files)) write(root, file, content);
  git(["add", ".githooks", ...Object.keys(files)], root);
  git(["commit", "-q", "-m", subject], root);
}

function captured(work) {
  const original = { log: console.log, error: console.error };
  const said = [];
  console.log = (...args) => said.push(args.join(" "));
  console.error = (...args) => said.push(args.join(" "));
  try {
    return { code: work(), said: said.join("\n") };
  } finally {
    Object.assign(console, original);
  }
}

function listed(file) {
  const { said } = captured(() => commitPart(["--list", file]));
  return [...said.matchAll(/^ {2}([0-9a-f]{6}(?:-\d+)?) {2}第 (\d+) 行/gm)].map(([, id, line]) => ({ id, line: Number(line) }));
}

function show(root, spec) {
  return execFileSync("git", ["show", spec], { cwd: root }).toString("utf8");
}

const head = (root) => git(["rev-parse", "HEAD"], root);
const subjects = (root) => git(["log", "--format=%s"], root).split("\n");
const status = (root) => execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean).sort();

test("hunks are numbered by content and a chosen subset applies onto the base", () => {
  const base = splitLines(Buffer.from("a\nb\nc\nd"));
  const work = splitLines(Buffer.from("A\nb\nc\nd\ne"));
  const hunks = buildHunks(base, work, parseRanges("@@ -1 +1 @@\n-a\n+A\n@@ -4 +4,2 @@\n-d\n\\ No newline at end of file\n+d\n+e\n\\ No newline at end of file\n"));
  assert.deepEqual(hunks.map(({ at, line, removed, added }) => [at, line, removed.join(""), added.join("")]), [[0, 1, "a\n", "A\n"], [3, 4, "d", "d\ne"]]);
  assert.equal(applyHunks(base, [hunks[1]]).toString(), "a\nb\nc\nd\ne");
  assert.equal(applyHunks(base, [hunks[1], hunks[0]]).toString(), "A\nb\nc\nd\ne");
  const shifted = buildHunks(splitLines(Buffer.from("x\na\n")), splitLines(Buffer.from("x\nA\n")), parseRanges("@@ -2 +2 @@"));
  assert.equal(shifted[0].id, hunks[0].id, "the same change further down keeps its number");
  const twins = buildHunks(splitLines(Buffer.from("k\nm\nk\n")), splitLines(Buffer.from("K\nm\nK\n")), parseRanges("@@ -1 +1 @@\n@@ -3 +3 @@"));
  assert.deepEqual(twins.map((hunk) => hunk.id), [twins[0].id, `${twins[0].id}-2`], "two identical changes stay apart");
  assert.deepEqual(strayLines([hunks[0]], hunks), { removed: [], added: [] });
  assert.deepEqual(strayLines([{ removed: [Buffer.from("c\n")], added: [] }], hunks), { removed: ["- c"], added: [] });
});

test("arguments: every way of naming what is mine, and the shapes that are refused", () => {
  const { request } = parseArgs(["-m", "t", "-F", "body.md", "--take", "a.ts:ab12cd,ef3456", "--match", "b.ts:^x:y", "--as", "c.ts=/tmp/c", "--dry-run", "--", "d.ts", "-odd"]);
  assert.deepEqual(request.messages, ["t"]);
  assert.equal(request.messageFile, "body.md");
  assert.deepEqual(request.parts, [
    { file: "a.ts", ids: ["ab12cd", "ef3456"], patterns: [], prepared: null },
    { file: "b.ts", ids: [], patterns: ["^x:y"], prepared: null },
    { file: "c.ts", ids: [], patterns: [], prepared: "/tmp/c" },
  ]);
  assert.deepEqual(request.whole, ["d.ts", "-odd"]);
  assert.equal(request.dryRun, true);
  assert.deepEqual(parseArgs(["-m", "t", "--", "d.ts", "--dry-run"]).request, { ...request, messageFile: null, parts: [], whole: ["d.ts"] }, "--dry-run counts after -- too");
  assert.deepEqual(parseArgs(["--list", "a.ts", "b.ts"]).request.list, ["a.ts", "b.ts"]);
  assert.match(parseArgs(["--take", "a.ts"]).error, /<文件>:<编号/);
  assert.match(parseArgs(["--as", "a.ts"]).error, /<文件>=<准备好的文件>/);
  assert.match(parseArgs(["-m"]).error, /后面要写内容/);
  assert.match(parseArgs(["--amend"]).error, /不认识参数 --amend/);
});

test("one file edited by two sessions: only my hunk is committed, the work tree and what others staged stay as they were", () => inTempRepo((root) => {
  seed(root, { "a.txt": TEN, "other.txt": "o\n" });
  write(root, "a.txt", TEN.replace("two", "TWO mine").replace("eight", "EIGHT theirs"));
  write(root, "other.txt", "o changed by them\n");
  write(root, "staged-new.txt", "theirs\n");
  git(["add", "other.txt", "staged-new.txt", "a.txt"], root);
  const [mine, theirs] = listed("a.txt");
  assert.deepEqual([mine.line, theirs.line], [2, 8]);
  write(root, "a.txt", `zero added later\n${TEN.replace("two", "TWO mine").replace("eight", "EIGHT theirs")}`);
  const before = head(root);

  const { code, said } = captured(() => commitPart(["-m", "mine only", "--take", `a.txt:${mine.id}`]));
  assert.equal(code, 0, said);
  assert.match(said, /还有 2 处留在工作区/);
  assert.equal(show(root, "HEAD:a.txt"), TEN.replace("two", "TWO mine"), "numbers follow the content, so a line added above did not shift the pick");
  assert.equal(git(["rev-parse", "HEAD^"], root), before);
  assert.equal(readFileSync(path.join(root, "a.txt"), "utf8").split("\n")[0], "zero added later", "the work tree is untouched");
  assert.deepEqual(status(root), [" M a.txt", "A  staged-new.txt", "M  other.txt"], "the shared index matches the new HEAD for a.txt and keeps what others staged");
  assert.doesNotMatch(git(["diff", "-U0", "a.txt"], root), /^[-+].*TWO mine/m, "my hunk no longer shows as a change");
}));

test("whole files and part of a file go into one commit: added, deleted, both ends of a rename, and a message body", () => inTempRepo((root) => {
  seed(root, { "part.txt": TEN, "gone.txt": "g\n", "old-name.txt": "r\n", "keep.txt": "k\n" });
  write(root, "part.txt", TEN.replace("three", "three mine").replace("nine", "nine theirs"));
  write(root, "new.txt", "n\n");
  write(root, "keep.txt", "k theirs\n");
  write(root, "body.md", "why it changed\n");
  rmSync(path.join(root, "gone.txt"));
  renameSync(path.join(root, "old-name.txt"), path.join(root, "new-name.txt"));
  const args = ["-m", "feat: mixed", "-F", "body.md", "--match", "part.txt:mine$", "--", "new.txt", "gone.txt", "old-name.txt", "new-name.txt"];
  const before = head(root);

  const dry = captured(() => commitPart([...args, "--dry-run"]));
  assert.match(captured(() => commitPart([...args, "-F"])).said, /-F 既不在工作区里.*参数写在 -- 前面/);
  assert.equal(dry.code, 0, dry.said);
  assert.match(dry.said, /A new\.txt/);
  assert.equal(head(root), before, "a dry run writes nothing");

  const { code, said } = captured(() => commitPart(args));
  assert.equal(code, 0, said);
  assert.deepEqual(git(["show", "--no-renames", "--name-status", "--format=", "HEAD"], root).split("\n").sort(), ["A\tnew-name.txt", "A\tnew.txt", "D\tgone.txt", "D\told-name.txt", "M\tpart.txt"]);
  assert.equal(git(["log", "-1", "--format=%B"], root), "feat: mixed\n\nwhy it changed");
  assert.equal(show(root, "HEAD:part.txt"), TEN.replace("three", "three mine"));
  assert.deepEqual(status(root), [" M keep.txt", " M part.txt", "?? body.md"], "everything that was mine is clean; theirs is still an unstaged edit");
}));

test("another commit lands between building the tree and moving the branch: the commit is rebuilt on it and nobody's change is lost", () => inTempRepo((root) => {
  seed(root, { "a.txt": TEN, "b.txt": "b\n" });
  write(root, "a.txt", TEN.replace("two", "TWO mine").replace("eight", "EIGHT theirs"));
  const [mine, theirs] = listed("a.txt");
  let landed = 0;
  const raced = captured(() =>
    commitPart(["-m", "mine", "--take", `a.txt:${mine.id}`], {
      beforeUpdate(attempt) {
        if (attempt === 1) landed += captured(() => commitPart(["-m", "theirs", "--take", `a.txt:${theirs.id}`])).code === 0 ? 1 : 0;
      },
    }),
  );
  assert.equal(raced.code, 0, raced.said);
  assert.equal(landed, 1);
  assert.match(raced.said, /照新的 HEAD 重来/);
  assert.deepEqual(subjects(root), ["mine", "theirs", "base"]);
  assert.equal(show(root, "HEAD:a.txt"), TEN.replace("two", "TWO mine").replace("eight", "EIGHT theirs"), "both changes are in");
  assert.equal(show(root, "HEAD^:a.txt"), TEN.replace("eight", "EIGHT theirs"));
  assert.deepEqual(status(root), []);

  write(root, "a.txt", TEN.replace("two", "TWO mine").replace("eight", "EIGHT theirs").replace("five", "FIVE mine"));
  const [again] = listed("a.txt");
  const swallowed = captured(() =>
    commitPart(["-m", "mine again", "--take", `a.txt:${again.id}`], {
      beforeUpdate(attempt) {
        if (attempt === 1) git(["commit", "-q", "-m", "they took the whole file", "--", "a.txt"], root);
      },
    }),
  );
  assert.equal(swallowed.code, 0, swallowed.said);
  assert.match(swallowed.said, /已经在「[0-9a-f]+ they took the whole file」里/);
  assert.equal(subjects(root)[0], "they took the whole file", "nothing is committed twice");

  write(root, "a.txt", TEN);
  const busyAt = head(root);
  const busy = captured(() =>
    commitPart(["-m", "never lands", "--", "a.txt"], {
      beforeUpdate(attempt) {
        write(root, "b.txt", `b ${attempt}\n`);
        git(["commit", "-q", "-m", `busy ${attempt}`, "--", "b.txt"], root);
      },
    }),
  );
  assert.equal(busy.code, 1);
  assert.match(busy.said, /连着 3 次/);
  assert.deepEqual(subjects(root).slice(0, 3), ["busy 3", "busy 2", "busy 1"], "the other commits all stand");
  assert.equal(git(["rev-list", "--count", `${busyAt}..HEAD`], root), "3");
}));

test("refusals leave the branch where it was: stale number, content prepared from an old version, Claude attribution, nothing chosen", () => inTempRepo((root) => {
  seed(root, { "a.txt": TEN, "same.txt": "s\n" });
  write(root, "prepared.txt", TEN.replace("two", "TWO mine"));
  write(root, "a.txt", TEN.replace("five", "FIVE theirs, committed"));
  git(["commit", "-q", "-m", "theirs", "--", "a.txt"], root);
  write(root, "a.txt", TEN.replace("five", "FIVE theirs, committed").replace("two", "TWO mine").replace("three", "THREE theirs, adjacent"));
  const before = head(root);
  const refused = (args, pattern) => {
    const { code, said } = captured(() => commitPart(args));
    assert.equal(code, 1, said);
    assert.match(said, pattern);
    assert.equal(head(root), before, "the branch did not move");
    assert.deepEqual(status(root), [" M a.txt", "?? prepared.txt"]);
  };

  const [only] = listed("a.txt");
  refused(["-m", "x", "--take", "a.txt:abcdef"], new RegExp(`没有编号 abcdef[\\s\\S]*${only.id}`));
  refused(["-m", "x", "--as", "a.txt=prepared.txt"], /会删掉 HEAD 里有、工作区里也还在的行[\s\S]*- FIVE theirs, committed/);
  refused(["-m", "x\n\nCo-Authored-By: Claude <noreply@anthropic.com>", "--take", `a.txt:${only.id}`], /commit-msg 钩子没有通过[\s\S]*Claude attribution/);
  refused(["-m", "x", "--match", "a.txt:nothing-like-this"], /没有匹配到任何一处/);
  refused(["-m", "x", "--", "same.txt"], /没有可提交的改动/);
  refused(["-m", "x", "--", "nowhere.txt"], /既不在工作区里，也不在 HEAD 里/);
  refused(["-m", "x"], /没有写要提交什么/);
  refused(["--take", `a.txt:${only.id}`], /要写提交说明/);
  refused(["-m", "x", "--take", `a.txt:${only.id}`, "--", "a.txt"], /选一种/);

  write(root, "prepared.txt", TEN.replace("five", "FIVE theirs, committed").replace("two", "TWO mine"));
  const { code, said } = captured(() => commitPart(["-m", "mine, split by hand", "--as", "a.txt=prepared.txt"]));
  assert.equal(code, 0, said);
  assert.equal(show(root, "HEAD:a.txt"), TEN.replace("five", "FIVE theirs, committed").replace("two", "TWO mine"), "two changes side by side are split with --as");
  assert.match(git(["diff", "-U0", "a.txt"], root), /THREE theirs, adjacent/);
  assert.doesNotMatch(git(["diff", "-U0", "a.txt"], root), /^[-+].*TWO mine/m);
}));

test("edges: no newline at the end, CRLF, the first line, a pure deletion, a file that is not in HEAD yet", () => inTempRepo((root) => {
  seed(root, { "tail.txt": "one\r\ntwo\r\nthree", "cut.txt": "1\n2\n3\n4\n5\n6\n" });
  write(root, "tail.txt", "ONE\r\ntwo\r\nthree\r\nfour");
  const [first, last] = listed("tail.txt");
  assert.equal(captured(() => commitPart(["-m", "first line", "--take", `tail.txt:${first.id}`])).code, 0);
  assert.equal(show(root, "HEAD:tail.txt"), "ONE\r\ntwo\r\nthree", "the last line still has no newline");
  assert.equal(captured(() => commitPart(["-m", "last line", "--take", `tail.txt:${last.id}`])).code, 0);
  assert.equal(show(root, "HEAD:tail.txt"), "ONE\r\ntwo\r\nthree\r\nfour");
  assert.deepEqual(status(root), []);

  write(root, "cut.txt", "first\n2\n3\n5\n6\n");
  assert.equal(captured(() => commitPart(["-m", "drop four", "--match", "cut.txt:^4$"])).code, 0);
  assert.equal(show(root, "HEAD:cut.txt"), "1\n2\n3\n5\n6\n");
  assert.equal(captured(() => commitPart(["-m", "first", "--match", "cut.txt:^first$"])).code, 0);
  assert.equal(show(root, "HEAD:cut.txt"), "first\n2\n3\n5\n6\n");

  write(root, "fresh.txt", "brand new\n");
  const [whole] = listed("fresh.txt");
  assert.equal(captured(() => commitPart(["-m", "fresh", "--take", `fresh.txt:${whole.id}`])).code, 0);
  assert.equal(show(root, "HEAD:fresh.txt"), "brand new\n");
  assert.deepEqual(status(root), []);
  assert.match(captured(() => commitPart(["--list", "cut.txt"])).said, /相对 HEAD 没有改动/);

  write(root, "cut.txt", "first\n2\n3\n5\n6\n7\n");
  write(root, path.join(".git", "index.lock"), "");
  const locked = captured(() => commitPart(["-m", "while the index is locked", "--", "cut.txt"]));
  rmSync(path.join(root, ".git", "index.lock"));
  assert.equal(locked.code, 0, locked.said);
  assert.match(locked.said, /提交已经成功，但共用索引没对齐[\s\S]*git reset -q -- cut\.txt/);
  assert.equal(subjects(root)[0], "while the index is locked");
}));

test("the pre-commit refusal points here, a commit through a custom index gets a reminder without being stopped, and the command runs from the mq entry", () => inTempRepo((root) => {
  const plain = { indexFile: ".git/index", gitDir: ".git", branch: "main", inSequence: false, env: {} };
  assert.match(commitBlock(plain), /pnpm mq:commit-part --list <文件>/);
  assert.equal(customIndexNote(plain), null);
  assert.equal(customIndexNote({ ...plain, indexFile: "/repo/.git/next-index-65194.lock", gitDir: "/repo/.git" }), null);
  assert.match(customIndexNote({ ...plain, indexFile: "/tmp/idx", gitDir: "/repo/.git" }), /自定义的 GIT_INDEX_FILE[\s\S]*pnpm mq:commit-part/);
  assert.equal(customIndexNote({ ...plain, indexFile: "/tmp/idx", gitDir: "/repo/.git", branch: "feat/x" }), null);
  assert.equal(customIndexNote({ ...plain, indexFile: undefined }), null);

  seed(root, { "a.txt": TEN });
  write(root, path.join(".githooks", "pre-commit"), `#!/usr/bin/env sh\nexec node "${MQ.split(path.sep).join("/")}" check-commit\n`);
  chmodSync(path.join(root, ".githooks", "pre-commit"), 0o755);
  const commitWith = (env, ...args) => spawnSync("git", ["commit", "-q", ...args], { cwd: root, encoding: "utf8", env: { ...process.env, ...env } });
  write(root, "a.txt", TEN.replace("two", "TWO"));
  git(["add", "a.txt"], root);
  const blocked = commitWith({}, "-m", "whole index");
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /pnpm mq:commit-part --list/);
  const named = commitWith({}, "-m", "named", "--", "a.txt");
  assert.equal(named.status, 0, named.stderr);
  assert.doesNotMatch(named.stderr, /提醒/);

  const custom = path.join(root, "custom-index");
  execFileSync("git", ["read-tree", "HEAD"], { cwd: root, env: { ...process.env, GIT_INDEX_FILE: custom } });
  write(root, "a.txt", TEN.replace("two", "TWO").replace("nine", "NINE"));
  execFileSync("git", ["add", "a.txt"], { cwd: root, env: { ...process.env, GIT_INDEX_FILE: custom } });
  const reminded = commitWith({ GIT_INDEX_FILE: custom, FUYU_COMMIT_WHOLE_INDEX: "1" }, "-m", "by hand");
  assert.equal(reminded.status, 0, reminded.stderr);
  assert.match(reminded.stderr, /提醒：这次提交用了自定义的 GIT_INDEX_FILE/);
  assert.notEqual(commitWith({ GIT_INDEX_FILE: custom }, "-m", "by hand again", "--allow-empty").status, 0, "without the override a whole-index commit is still refused");

  write(root, "a.txt", TEN.replace("two", "TWO").replace("nine", "NINE").replace("five", "FIVE"));
  const cli = (...args) => spawnSync(process.execPath, [MQ, "commit-part", ...args], { cwd: root, encoding: "utf8" });
  const [, id] = /^ {2}([0-9a-f]{6}) {2}第 5 行/m.exec(cli("--list", "a.txt").stdout);
  const done = cli("-m", "from the entry", "--take", `a.txt:${id}`);
  assert.equal(done.status, 0, done.stderr);
  assert.equal(subjects(root)[0], "from the entry");
  assert.match(cli().stdout, /^用法：/);
  assert.equal(cli("--amend").status, 1);
}));
