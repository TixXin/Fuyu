import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SEQUENCES } from "./checkCommit.mjs";
import { applyHunks, buildHunks, describeHunk, matchingHunks, parseRanges, splitLines, strayLines } from "./hunks.mjs";

const ATTEMPTS = 3;
const LOCK_RETRIES = 5;
const LOCK_WAIT_MS = 300;
const STRAY_SHOWN = 5;
const VALUE_OPTIONS = ["-m", "-F", "--take", "--match", "--as"];
const PART_SHAPES = { "--take": "<文件>:<编号,编号…>", "--match": "<文件>:<正则>", "--as": "<文件>=<准备好的文件>" };

class Refusal extends Error {}

function gitEnv(indexFile) {
  const env = { ...process.env };
  delete env.GIT_INDEX_FILE;
  if (indexFile) env.GIT_INDEX_FILE = indexFile;
  return env;
}

function run(repo, args, { input, indexFile, raw } = {}) {
  const out = execFileSync("git", args, { cwd: repo.top, input, env: gitEnv(indexFile), stdio: ["pipe", "pipe", "pipe"], maxBuffer: 1 << 30 });
  return raw ? out : out.toString("utf8").trim();
}

function tryRun(repo, args, options) {
  try {
    return { ok: true, out: run(repo, args, options) };
  } catch (error) {
    return { ok: false, out: `${error.stdout ?? ""}${error.stderr ?? ""}`.trim() };
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function parseArgs(argv) {
  const request = { list: null, messages: [], messageFile: null, parts: [], whole: [], dryRun: false };
  const part = (file) => {
    const found = request.parts.find((entry) => entry.file === file);
    if (found) return found;
    request.parts.push({ file, ids: [], patterns: [], prepared: null });
    return request.parts.at(-1);
  };
  for (let at = 0; at < argv.length; at += 1) {
    const arg = argv[at];
    if (arg === "--") {
      const rest = argv.slice(at + 1);
      request.dryRun ||= rest.includes("--dry-run");
      request.whole.push(...rest.filter((file) => file !== "--dry-run"));
      break;
    }
    if (arg === "--dry-run") request.dryRun = true;
    else if (arg === "--list") {
      request.list ??= [];
      while (at + 1 < argv.length && !argv[at + 1].startsWith("-")) request.list.push(argv[(at += 1)]);
    } else if (VALUE_OPTIONS.includes(arg)) {
      const value = argv[(at += 1)];
      if (value === undefined) return { error: `${arg} 后面要写内容。` };
      if (arg === "-m") request.messages.push(value);
      else if (arg === "-F") request.messageFile = value;
      else {
        const cut = arg === "--take" ? value.lastIndexOf(":") : value.indexOf(arg === "--as" ? "=" : ":");
        if (cut < 1 || cut === value.length - 1) return { error: `${arg} 的写法是 ${PART_SHAPES[arg]}。` };
        const [file, rest] = [value.slice(0, cut), value.slice(cut + 1)];
        if (arg === "--take") part(file).ids.push(...rest.split(",").map((id) => id.trim()).filter(Boolean));
        if (arg === "--match") part(file).patterns.push(rest);
        if (arg === "--as") part(file).prepared = rest;
      }
    } else return { error: `commit-part 不认识参数 ${arg}。` };
  }
  if (request.list) {
    request.list.push(...request.whole);
    request.whole = [];
  }
  return { request };
}

function openRepo() {
  const here = { top: process.cwd() };
  const top = run(here, ["rev-parse", "--show-toplevel"]);
  return { top, gitDir: run(here, ["rev-parse", "--absolute-git-dir"]), cwd: process.cwd() };
}

function inRepo(repo, file) {
  const relative = path.relative(repo.top, path.resolve(repo.cwd, file)).split(path.sep).join("/");
  if (!relative || relative.startsWith("..")) throw new Refusal(`${file} 不在这个仓库里。`);
  return relative;
}

function lstatOf(repo, file) {
  try {
    return lstatSync(path.join(repo.top, file));
  } catch {
    return null;
  }
}

function headEntry(repo, head, file) {
  const line = run(repo, ["--literal-pathspecs", "ls-tree", head, "--", file]);
  const found = /^(\d+) blob ([0-9a-f]+)\t/.exec(line);
  return found ? { mode: found[1], sha: found[2] } : null;
}

function blob(repo, sha) {
  return run(repo, ["cat-file", "blob", sha], { raw: true });
}

function hunksBetween(repo, baseSha, workSha) {
  if (baseSha === workSha) return { baseLines: splitLines(blob(repo, baseSha)), hunks: [] };
  const diff = run(repo, ["diff", "--no-color", "--no-ext-diff", "--no-textconv", "--inter-hunk-context=0", "-U0", baseSha, workSha], { raw: true });
  const baseLines = splitLines(blob(repo, baseSha));
  const hunks = buildHunks(baseLines, splitLines(blob(repo, workSha)), parseRanges(diff.toString("latin1")));
  return { baseLines, hunks, binary: hunks.length === 0 };
}

function workState(repo, head, file) {
  const stat = lstatOf(repo, file);
  if (!stat) throw new Refusal(`${file} 不在工作区里；要提交整个文件的删除，把它写在 -- 后面。`);
  if (!stat.isFile()) throw new Refusal(`${file} 不是普通文件，只能整个带（写在 -- 后面）。`);
  const base = headEntry(repo, head, file);
  const baseSha = base?.sha ?? run(repo, ["hash-object", "-w", "--stdin"], { input: "" });
  const workSha = run(repo, ["hash-object", "-w", "--", file]);
  const between = hunksBetween(repo, baseSha, workSha);
  if (between.binary) throw new Refusal(`${file} 是二进制文件，只能整个带（写在 -- 后面）。`);
  return { ...between, baseSha, workSha, mode: base?.mode ?? (stat.mode & 0o111 ? "100755" : "100644") };
}

function listing(file, hunks) {
  if (!hunks.length) return [`${file}  相对 HEAD 没有改动`];
  return [`${file}  ${hunks.length} 处`, ...hunks.flatMap(describeHunk)];
}

function choose(repo, entry, state, origin) {
  const chosen = new Map();
  const landed = [];
  const missing = [];
  for (const id of entry.ids) {
    const found = state.hunks.find((hunk) => hunk.id === id);
    if (found) chosen.set(found.id, found);
    else if (origin?.landed(id, state.baseSha)) landed.push(id);
    else missing.push(id);
  }
  if (missing.length) throw new Refusal([`${entry.file} 里没有编号 ${missing.join("、")}（文件在列出之后变了，或者写错了）。现在是：`, ...listing(entry.file, state.hunks)].join("\n"));
  for (const pattern of entry.patterns) {
    const matched = matchingHunks(state.hunks, pattern);
    if (!matched.length) throw new Refusal([`--match ${entry.file}:${pattern} 没有匹配到任何一处。现在是：`, ...listing(entry.file, state.hunks)].join("\n"));
    for (const hunk of matched) chosen.set(hunk.id, hunk);
  }
  return { chosen: [...chosen.values()], landed };
}

function guard(repo, entry, state, sha) {
  const result = hunksBetween(repo, state.baseSha, sha);
  if (result.binary) throw new Refusal(`${entry.file}：准备好的内容是二进制的，只能整个带。`);
  const stray = strayLines(result.hunks, state.hunks);
  if (!stray.removed.length && !stray.added.length) return;
  const show = (lines) => lines.slice(0, STRAY_SHOWN).map((line) => `    ${line}`);
  throw new Refusal(
    [
      `${entry.file}：要提交的内容里有工作区相对 HEAD 没有的改动，没有提交。`,
      ...(stray.removed.length ? ["  会删掉 HEAD 里有、工作区里也还在的行（多半是照旧版本准备的）：", ...show(stray.removed)] : []),
      ...(stray.added.length ? ["  会加上工作区里没有的行：", ...show(stray.added)] : []),
      `  照现在的 HEAD 重新准备：git show HEAD:${entry.file}`,
    ].join("\n"),
  );
}

function resolvePart(repo, head, entry, origin) {
  const state = workState(repo, head, entry.file);
  if (entry.prepared !== null) {
    const prepared = path.resolve(repo.cwd, entry.prepared);
    if (!existsSync(prepared)) throw new Refusal(`找不到准备好的文件 ${entry.prepared}。`);
    const sha = run(repo, ["hash-object", "-w", `--path=${entry.file}`, "--", prepared]);
    guard(repo, entry, state, sha);
    return { file: entry.file, sha, mode: state.mode, chosen: [], landed: [], left: null, state };
  }
  const { chosen, landed } = choose(repo, entry, state, origin);
  const sha = run(repo, ["hash-object", "-w", "--stdin"], { input: applyHunks(state.baseLines, chosen) });
  guard(repo, entry, state, sha);
  return { file: entry.file, sha, mode: state.mode, chosen, landed, left: state.hunks.length - chosen.length, state };
}

function originOf(repo, resolved) {
  const hashes = new Map(resolved.chosen.map((hunk) => [hunk.id, hunk.hash]));
  return {
    landed(id, baseSha) {
      if (!hashes.has(id) || baseSha === resolved.state.baseSha) return false;
      return hunksBetween(repo, resolved.state.baseSha, baseSha).hunks.some((hunk) => hunk.hash === hashes.get(id));
    },
  };
}

function buildTree(repo, head, plan, indexFile) {
  run(repo, ["read-tree", head], { indexFile });
  for (const file of plan.whole) {
    const stat = lstatOf(repo, file);
    if (stat?.isDirectory()) throw new Refusal(`${file} 是目录；-- 后面写具体的文件，免得带上别的会话的改动。`);
    if (!stat && !headEntry(repo, head, file)) {
      if (plan.attempt > 1) continue;
      throw new Refusal(`${file} 既不在工作区里，也不在 HEAD 里。${file.startsWith("-") ? "-- 后面的都当成文件，参数写在 -- 前面。" : ""}`);
    }
    const added = tryRun(repo, ["--literal-pathspecs", "add", "-A", "--", file], { indexFile });
    if (!added.ok) throw new Refusal(`${file} 加不进提交：\n${added.out}`);
  }
  const parts = plan.parts.map((entry) => resolvePart(repo, head, entry, plan.origins.get(entry.file)));
  for (const part of parts) run(repo, ["update-index", "--add", "--cacheinfo", `${part.mode},${part.sha},${part.file}`], { indexFile });
  return { tree: run(repo, ["write-tree"], { indexFile }), parts };
}

function changedPaths(repo, from, to) {
  const out = run(repo, ["-c", "core.quotepath=off", "diff-tree", "-r", "--no-renames", "--name-status", from, to]);
  return out ? out.split("\n").map((line) => line.split("\t")).map(([status, file]) => ({ status, file })) : [];
}

function summary(changes, parts) {
  const notes = new Map(parts.map((part) => [part.file, part]));
  const lines = changes.map(({ status, file }) => {
    const part = notes.get(file);
    if (!part || part.left === null) return `  ${status} ${file}`;
    return `  ${status} ${file}   带了 ${part.chosen.map((hunk) => hunk.id).join(",")}${part.left ? `，还有 ${part.left} 处留在工作区` : ""}`;
  });
  for (const part of parts) if (part.landed.length) lines.push(`  ${part.file} 的 ${part.landed.join(",")} 已经在 HEAD 里（别的提交带上了），没有重复提交`);
  return lines;
}

function prepareMessage(repo, request, scratch) {
  const pieces = [...request.messages];
  if (request.messageFile) {
    const file = path.resolve(repo.cwd, request.messageFile);
    if (!existsSync(file)) throw new Refusal(`找不到说明文件 ${request.messageFile}。`);
    pieces.push(readFileSync(file, "utf8"));
  }
  if (!pieces.length) {
    if (request.dryRun) return null;
    throw new Refusal('要写提交说明：-m "<标题>"，说明正文用 -F <文件>。');
  }
  const file = path.join(scratch, "COMMIT_EDITMSG");
  writeFileSync(file, `${pieces.map((piece) => piece.trim()).join("\n\n")}\n`);
  const hook = tryRun(repo, ["hook", "run", "--ignore-missing", "commit-msg", "--", file]);
  if (!hook.ok) throw new Refusal(`commit-msg 钩子没有通过，没有提交：\n${hook.out}`);
  const text = run(repo, ["stripspace"], { input: readFileSync(file) });
  if (!text) throw new Refusal("提交说明是空的。");
  writeFileSync(file, `${text}\n`);
  return { file, subject: text.split("\n")[0] };
}

function alignIndex(repo, files) {
  const args = ["--literal-pathspecs", "reset", "-q", "--", ...files];
  for (let turn = 0; turn < LOCK_RETRIES; turn += 1) {
    const reset = tryRun(repo, args);
    if (reset.ok) return;
    if (!/index\.lock/.test(reset.out)) break;
    sleep(LOCK_WAIT_MS);
  }
  console.log(`[commit-part] 提交已经成功，但共用索引没对齐（多半是别的 git 进程占着）。稍后自己跑一次：\n  git reset -q -- ${files.join(" ")}`);
}

function list(repo, files) {
  if (!files.length) throw new Refusal("--list 后面要写文件。");
  const head = run(repo, ["rev-parse", "HEAD"]);
  const names = files.map((file) => inRepo(repo, file));
  for (const file of names) console.log(listing(file, workState(repo, head, file).hunks).join("\n"));
  console.log(`\n只带其中几处：pnpm mq:commit-part -m "<标题>" --take ${names[0]}:<编号,编号…>`);
  return 0;
}

function planOf(repo, request) {
  const parts = request.parts.map((entry) => ({ ...entry, file: inRepo(repo, entry.file) }));
  const whole = [...new Set(request.whole.map((file) => inRepo(repo, file)))];
  for (const entry of parts) {
    if (whole.includes(entry.file)) throw new Refusal(`${entry.file} 既写在 -- 后面又只带一部分，选一种。`);
    if (entry.prepared !== null && (entry.ids.length || entry.patterns.length)) throw new Refusal(`${entry.file} 既用了 --as 又用了 --take / --match，选一种。`);
    for (const pattern of entry.patterns) {
      try {
        new RegExp(pattern, "u");
      } catch (error) {
        throw new Refusal(`--match ${entry.file} 的正则写错了：${error.message}`);
      }
    }
  }
  if (!parts.length && !whole.length) throw new Refusal("没有写要提交什么：--take、--match、--as，或把整个文件写在 -- 后面。");
  return { parts, whole, origins: new Map(), attempt: 1 };
}

function commit(repo, request, hooks, scratch) {
  if (SEQUENCES.some((name) => existsSync(path.join(repo.gitDir, name)))) throw new Refusal("正在合并、cherry-pick 或 rebase 的过程中，先把它做完。");
  const plan = planOf(repo, request);
  const files = [...plan.whole, ...plan.parts.map((entry) => entry.file)];
  const message = prepareMessage(repo, request, scratch);
  const indexFile = path.join(scratch, "index");
  const first = run(repo, ["rev-parse", "HEAD"]);
  for (plan.attempt = 1; plan.attempt <= ATTEMPTS; plan.attempt += 1) {
    const head = plan.attempt === 1 ? first : run(repo, ["rev-parse", "HEAD"]);
    rmSync(indexFile, { force: true });
    const { tree, parts } = buildTree(repo, head, plan, indexFile);
    const changes = changedPaths(repo, head, tree);
    if (!changes.length) {
      if (plan.attempt === 1) throw new Refusal("选中的内容和 HEAD 一样，没有可提交的改动。");
      const by = run(repo, ["log", "-1", "--format=%h %s", `${first}..${head}`, "--", ...files]) || run(repo, ["log", "-1", "--format=%h %s", head]);
      console.log(`[commit-part] 这些改动已经在「${by}」里，没有重复提交。`);
      return 0;
    }
    if (request.dryRun) {
      console.log(["[commit-part] 会提交（--dry-run，什么都没写）：", ...summary(changes, parts), run(repo, ["diff", "--stat", head, tree])].join("\n"));
      return 0;
    }
    for (const part of parts) if (!plan.origins.has(part.file)) plan.origins.set(part.file, originOf(repo, part));
    plan.parts = plan.parts.map((entry) => (entry.prepared !== null ? entry : { ...entry, patterns: [], ids: [...new Set([...entry.ids, ...parts.find((part) => part.file === entry.file).chosen.map((hunk) => hunk.id)])] }));
    const made = run(repo, ["commit-tree", tree, "-p", head, "-F", message.file]);
    hooks.beforeUpdate?.(plan.attempt);
    const moved = tryRun(repo, ["update-ref", "-m", `commit (commit-part): ${message.subject}`, "HEAD", made, head]);
    if (moved.ok) {
      console.log([`[commit-part] 提交了 ${made.slice(0, 8)} ${message.subject}`, ...summary(changes, parts)].join("\n"));
      alignIndex(repo, files);
      return 0;
    }
    if (run(repo, ["rev-parse", "HEAD"]) === head) throw new Error(`分支没能推进：${moved.out}`);
    console.log(`[commit-part] 搭提交的时候 HEAD 被别的提交推进了，照新的 HEAD 重来（第 ${plan.attempt} 次）。`);
  }
  throw new Refusal(`HEAD 连着 ${ATTEMPTS} 次在提交前被推进，没有提交。等别的会话提交完再跑一次。`);
}

export function commitPart(argv, hooks = {}) {
  const { request, error } = parseArgs(argv);
  if (error) {
    console.error(`[commit-part] ${error}`);
    return 1;
  }
  const scratch = mkdtempSync(path.join(tmpdir(), "fuyu-commit-part-"));
  try {
    const repo = openRepo();
    return request.list ? list(repo, request.list) : commit(repo, request, hooks, scratch);
  } catch (failure) {
    if (!(failure instanceof Refusal)) throw failure;
    console.error(`[commit-part] ${failure.message}`);
    return 1;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
