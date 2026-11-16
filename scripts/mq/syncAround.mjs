import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { retryOnLock, waitForIndex } from "./indexLock.mjs";
import { git, tryGit } from "./settings.mjs";
import { mergedWith } from "./upto.mjs";

export function dirtyEntries(cwd) {
  const out = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const parts = out.split("\0");
  const entries = new Map();
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part.length < 4) continue;
    const entry = { staged: part[0] !== " " && part[0] !== "?", untracked: part[0] === "?" };
    entries.set(part.slice(3), entry);
    if (part[0] === "R" || part[0] === "C") {
      i += 1;
      if (parts[i]) entries.set(parts[i], entry);
    }
  }
  return entries;
}

export function changedBetween(cwd, from, to) {
  return git(["diff", "--name-only", "--no-renames", "-z", from, to], cwd).split("\0").filter(Boolean);
}

function blob(cwd, rev, file) {
  if (!tryGit(["cat-file", "-e", `${rev}:${file}`], cwd).ok) return null;
  return execFileSync("git", ["cat-file", "blob", `${rev}:${file}`], { cwd, maxBuffer: 256 * 1024 * 1024 });
}

const BIG = 256 * 1024 * 1024;

function storedForm(cwd, file, content) {
  const sha = execFileSync("git", ["hash-object", "-w", "--stdin", `--path=${file}`], { cwd, input: content, encoding: "utf8" }).trim();
  return execFileSync("git", ["cat-file", "blob", sha], { cwd, maxBuffer: BIG });
}

function workTreeForm(cwd, file, content) {
  const sha = execFileSync("git", ["hash-object", "-w", "--stdin", "--no-filters"], { cwd, input: content, encoding: "utf8" }).trim();
  return execFileSync("git", ["cat-file", "--filters", `--path=${file}`, sha], { cwd, maxBuffer: BIG });
}

function mergeFile(current, base, theirs) {
  const dir = mkdtempSync(path.join(tmpdir(), "mq-sync-"));
  try {
    const files = ["current", "base", "theirs"].map((name) => path.join(dir, name));
    [current, base, theirs].forEach((content, index) => writeFileSync(files[index], content));
    const result = spawnSync("git", ["merge-file", "-p", ...files], { maxBuffer: 256 * 1024 * 1024 });
    return { text: result.stdout, clean: result.status === 0 };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function planFor(cwd, head, merged, file, entry) {
  const abs = path.join(cwd, file);
  if (entry.staged) return { file, why: "暂存区里有它的改动" };
  if (entry.untracked) return { file, why: "工作区里有一个同名的新文件" };
  const base = blob(cwd, head, file);
  const theirs = blob(cwd, merged, file);
  if (!base || !theirs || !existsSync(abs)) return { file, why: "一边新增或删除了它" };
  const current = readFileSync(abs);
  const { text, clean } = mergeFile(storedForm(cwd, file, current), base, theirs);
  return clean ? { file, abs, current, text } : { file, why: "没提交的改动和 origin/main 改了同一处" };
}

function gitWithInput(args, cwd, input) {
  const result = spawnSync("git", args, { cwd, input, encoding: "utf8" });
  return { ok: result.status === 0, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

function checkoutPaths(cwd, merged, files) {
  if (!files.length) return { ok: true, out: "" };
  const args = ["restore", `--source=${merged}`, "--staged", "--worktree", "--pathspec-from-file=-", "--pathspec-file-nul"];
  return retryOnLock(() => gitWithInput(args, cwd, files.join("\0")));
}

function keepEdits(cwd, merged, plans) {
  if (!plans.length) return { ok: true, raced: [] };
  const info = plans.map((plan) => {
    const [mode, , sha] = git(["ls-tree", merged, "--", plan.file], cwd).split(/\s+/);
    return `${mode} ${sha}\t${plan.file}\0`;
  }).join("");
  const indexed = retryOnLock(() => gitWithInput(["update-index", "-z", "--index-info"], cwd, info));
  if (!indexed.ok) return { ok: false, out: indexed.out };
  const raced = [];
  for (const plan of plans) {
    if (!readFileSync(plan.abs).equals(plan.current)) {
      raced.push(plan.file);
      continue;
    }
    writeFileSync(plan.abs, workTreeForm(cwd, plan.file, plan.text));
  }
  return { ok: true, raced };
}

export function syncAround(cwd, upstream) {
  const head = git(["rev-parse", "HEAD"], cwd);
  const ref = git(["symbolic-ref", "HEAD"], cwd);
  const forward = tryGit(["merge-base", "--is-ancestor", head, upstream], cwd).ok;
  const { rev: merged, conflicts } = forward ? { rev: git(["rev-parse", upstream], cwd), conflicts: [] } : mergedWith(head, upstream, cwd);
  if (!merged) return { ok: false, conflicts };
  const changed = changedBetween(cwd, head, merged);
  const touched = (dirty) => changed.filter((file) => dirty.has(file));
  const dirty = dirtyEntries(cwd);
  const plans = touched(dirty).map((file) => planFor(cwd, head, merged, file, dirty.get(file)));
  const blocked = plans.filter((plan) => plan.why);
  if (blocked.length) return { ok: false, blocked };
  if (!waitForIndex(cwd)) return { ok: false, busy: "index.lock" };
  if (touched(dirtyEntries(cwd)).join("\0") !== plans.map((plan) => plan.file).join("\0")) return { ok: false, busy: "files" };
  if (!tryGit(["update-ref", "-m", `mq sync: ${upstream} around uncommitted files`, ref, merged, head], cwd).ok) return { ok: false, moved: true };
  const checkedOut = checkoutPaths(cwd, merged, changed.filter((file) => !dirty.has(file)));
  if (!checkedOut.ok) {
    tryGit(["update-ref", "-m", "mq sync: back out, index busy", ref, head, merged], cwd);
    return { ok: false, busy: "index.lock", out: checkedOut.out };
  }
  const kept = keepEdits(cwd, merged, plans);
  if (!kept.ok) return { ok: true, merged, kept: [], raced: plans.map((plan) => plan.file) };
  return { ok: true, merged, kept: plans.map((plan) => plan.file).filter((file) => !kept.raced.includes(file)), raced: kept.raced };
}
