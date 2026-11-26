import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REMOTE_ENV = "FUYU_HEAVY_REMOTE";
const DEFAULT_ROOT = "C:/fuyu-runner";
const DEFAULT_WORKTREES = 3;
const LOCAL_ONLY = new Set(["FUYU_HEAVY", REMOTE_ENV, "FUYU_HEAVY_DIR", "FUYU_HEAVY_REMOTE_CONFIG"]);
const HOST = /^[A-Za-z0-9][A-Za-z0-9_.@-]*$/;
const SSH = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=6", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=4"];

export function configFile(env = process.env) {
  return env.FUYU_HEAVY_REMOTE_CONFIG || path.join(os.homedir(), ".config", "fuyu-heavy", "remote.json");
}

export function remoteConfig(env = process.env, read = (file) => readFileSync(file, "utf8")) {
  const set = env[REMOTE_ENV]?.trim();
  if (set === "off" || set === "0" || process.platform === "win32") return null;
  let saved = {};
  try {
    saved = JSON.parse(read(configFile(env))) ?? {};
  } catch {
    saved = {};
  }
  if (saved.enabled === false && !set) return null;
  const host = set || saved.host;
  if (typeof host !== "string" || !HOST.test(host)) return null;
  const root = typeof saved.root === "string" && /^[A-Za-z]:[\\/][^'"`$]*$/.test(saved.root) ? saved.root.replace(/\\/g, "/").replace(/\/+$/, "") : DEFAULT_ROOT;
  const worktrees = Number.isInteger(saved.worktrees) && saved.worktrees > 0 && saved.worktrees <= 16 ? saved.worktrees : DEFAULT_WORKTREES;
  return { host, root, worktrees };
}

export function forwardedEnv(env) {
  return Object.fromEntries(
    Object.entries(env).filter(([name, value]) => name.startsWith("FUYU_") && !LOCAL_ONLY.has(name) && typeof value === "string"),
  );
}

export function psLiteral(text) {
  return `'${String(text).replace(/['\u2018\u2019\u201a\u201b]/g, "$&$&")}'`;
}

export function jobScript(params, body) {
  return `$p = ConvertFrom-Json ${psLiteral(JSON.stringify(params))}\n${body}`;
}

export function encodedCommand(script) {
  const encoded = Buffer.from(script, "utf8").toString("base64");
  return `[Console]::OutputEncoding=[Text.Encoding]::UTF8; & ([scriptblock]::Create([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))))`;
}

export function jobId(now = Date.now(), pid = process.pid) {
  return `${now.toString(36)}-${pid}`;
}

function git(cwd, args, env = process.env) {
  return execFileSync("git", args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function snapshotCommit(cwd) {
  const head = git(cwd, ["rev-parse", "HEAD"]);
  const index = path.resolve(cwd, git(cwd, ["rev-parse", "--git-path", "index"]));
  const dir = mkdtempSync(path.join(os.tmpdir(), "fuyu-heavy-"));
  const temp = path.join(dir, "index");
  try {
    if (existsSync(index)) copyFileSync(index, temp);
    const env = { ...process.env, GIT_INDEX_FILE: temp };
    git(cwd, ["add", "-A", ":/"], env);
    const tree = git(cwd, ["write-tree"], env);
    if (tree === git(cwd, ["rev-parse", "HEAD^{tree}"])) return { sha: head, dirty: false };
    return { sha: git(cwd, ["commit-tree", tree, "-p", head, "-m", "heavy: uncommitted changes"]), dirty: true };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function ssh(config, script, stdio) {
  return spawnSync("ssh", ["-n", ...SSH, config.host, encodedCommand(script)], { stdio, encoding: stdio === "inherit" ? undefined : "utf8" });
}

function bringBack(cwd, config, id, log) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "fuyu-heavy-out-"));
  const patch = path.join(dir, `${id}.patch`);
  const copied = spawnSync("scp", ["-q", ...SSH, `${config.host}:${config.root}/out/${id}.patch`, patch], { stdio: ["ignore", "ignore", "pipe"], encoding: "utf8" });
  if (copied.status !== 0 || !existsSync(patch)) {
    rmSync(dir, { recursive: true, force: true });
    return;
  }
  if (statSync(patch).size === 0) {
    rmSync(dir, { recursive: true, force: true });
    return;
  }
  const top = git(cwd, ["rev-parse", "--show-toplevel"]);
  const files = spawnSync("git", ["apply", "--numstat", patch], { cwd: top, encoding: "utf8" }).stdout.trim().split("\n").filter(Boolean).map((line) => line.split("\t").pop());
  const applied = spawnSync("git", ["apply", "--binary", "--whitespace=nowarn", patch], { cwd: top, encoding: "utf8" });
  if (applied.status === 0) {
    log(`[heavy:remote] 远程改了 ${files.length} 个文件，已同步回本机：${files.slice(0, 8).join("、")}${files.length > 8 ? " …" : ""}`);
    rmSync(dir, { recursive: true, force: true });
    return;
  }
  log(`[heavy:remote] 远程改了 ${files.length} 个文件，但和本机现在的文件对不上，没有同步。补丁留在 ${patch}，可以 git apply --3way 手动合。`);
  log(applied.stderr.trim());
}

export function runRemote(argv, config, { cwd = process.cwd(), env = process.env, log = console.log } = {}) {
  const body = readFileSync(path.join(HERE, "remote-job.ps1"), "utf8");
  const origin = git(cwd, ["remote", "get-url", "origin"]);
  const prepared = ssh(config, jobScript({ step: "prepare", root: config.root, origin }, body), ["ignore", "pipe", "pipe"]);
  if (prepared.status !== 0) {
    const why = (prepared.stderr || prepared.stdout || "").trim().split("\n").slice(-2).join(" ");
    log(`[heavy:remote] 连不上 ${config.host}，改在本机跑（${why || `ssh 退出码 ${prepared.status}`}）`);
    return null;
  }
  let snapshot;
  try {
    snapshot = snapshotCommit(cwd);
  } catch (error) {
    log(`[heavy:remote] 打包本机改动失败，改在本机跑：${error.message}`);
    return null;
  }
  const id = jobId();
  const pushed = spawnSync("git", ["push", "--quiet", "--no-verify", "--receive-pack=git receive-pack", `${config.host}:${config.root}/repo`, `${snapshot.sha}:refs/fuyu-jobs/${id}`], { cwd, env: { ...env, GIT_SSH_COMMAND: env.GIT_SSH_COMMAND || ["ssh", ...SSH].join(" ") }, stdio: ["ignore", "ignore", "pipe"], encoding: "utf8" });
  if (pushed.status !== 0) {
    log(`[heavy:remote] 代码送不到 ${config.host}，改在本机跑：${pushed.stderr.trim()}`);
    return null;
  }
  const subdir = git(cwd, ["rev-parse", "--show-prefix"]).replace(/\/$/, "");
  log(`[heavy:remote] 转到 ${config.host} 跑（${snapshot.sha.slice(0, 9)}${snapshot.dirty ? "，含没提交的改动" : ""}）；本机不编译。FUYU_HEAVY_REMOTE=off 可改回本机。`);
  const started = Date.now();
  const params = { step: "run", id, sha: snapshot.sha, argv, root: config.root, origin, worktrees: config.worktrees, subdir, env: forwardedEnv(env) };
  const result = ssh(config, jobScript(params, body), "inherit");
  bringBack(cwd, config, id, log);
  log(`[heavy:remote] ${config.host} 上跑完，退出码 ${result.status ?? "?"}，用时 ${Math.round((Date.now() - started) / 1000)} 秒`);
  return result.status ?? 1;
}
