import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { INTEGRATION_BRANCH, git, mainCheckoutOf, tryGit } from "./settings.mjs";

export const STEPS = ["verify", "regression", "exe"];
const COMMANDS = {
  verify: ["pnpm", "verify"],
  regression: ["pnpm", "test:regression"],
  exe: ["pnpm", "build:exe"],
};
const DOCS_ONLY = /(^docs\/|\.md$)/;
const PNPM = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

export function verifyDirOf(main) {
  return path.join(path.dirname(main), `${path.basename(main)}-verify`);
}

function commonDir(cwd = process.cwd()) {
  return path.resolve(cwd, git(["rev-parse", "--git-common-dir"], cwd));
}

export function recordFile(cwd = process.cwd()) {
  return path.join(commonDir(cwd), "fuyu-verify.json");
}

export function readRecord(cwd = process.cwd()) {
  try {
    return JSON.parse(readFileSync(recordFile(cwd), "utf8"));
  } catch {
    return null;
  }
}

export function verifyRequest(args) {
  const steps = [];
  const pages = [];
  let commit = null;
  let force = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--only") {
      const named = (args[++i] ?? "").split(",").filter(Boolean);
      const unknown = named.find((step) => !STEPS.includes(step));
      if (!named.length || unknown) return { error: `--only 后面写 ${STEPS.join("、")} 里的几项，用逗号隔开。` };
      steps.push(...named);
    } else if (arg === "--pages") {
      while (args[i + 1] && !args[i + 1].startsWith("--")) pages.push(args[++i]);
      if (!pages.length) return { error: "--pages 后面写页面名中的词。" };
    } else if (arg === "--force") {
      force = true;
    } else if (arg.startsWith("-")) {
      return { error: `verify 不认识参数 ${arg}。` };
    } else if (commit) {
      return { error: "只能写一个提交号。" };
    } else {
      commit = arg;
    }
  }
  const chosen = steps.length ? [...new Set(steps)] : pages.length ? ["regression"] : STEPS;
  if (pages.length && !chosen.includes("regression")) return { error: "--pages 只对 regression 有用。" };
  return { commit, steps: chosen, pages, force };
}

export function failedPages(output) {
  return [...new Set(output.split("\n").map((line) => line.match(/^✗ (\S+)/)?.[1]).filter(Boolean))];
}

const coversAll = (failed, words) => failed.every((page) => words.some((word) => page.includes(word)));

export function nextRecord(previous, { sha, carry, results, pages, now = Date.now() }) {
  const kept = previous && (previous.sha === sha || carry) ? previous : null;
  const passed = { ...(kept?.passed ?? {}) };
  let failed = kept?.failedPages ?? [];
  for (const { step, ok, failedPages: pagesFailed = [] } of results) {
    if (step === "regression" && pages.length) {
      if (ok && coversAll(failed, pages)) {
        passed.regression = { at: now, sha };
        failed = [];
      } else if (!ok) {
        delete passed.regression;
        failed = [...new Set([...failed, ...pagesFailed])];
      }
      continue;
    }
    if (ok) passed[step] = { at: now, sha };
    else delete passed[step];
    if (step === "regression") failed = ok ? [] : pagesFailed;
  }
  return { sha, passed, failedPages: failed };
}

export const verifiedAt = (record, sha) => record?.sha === sha && STEPS.every((step) => record.passed?.[step]);

export function verificationRefusal({ record, target, files, unverified = false, only = false }) {
  if (only || unverified) return null;
  if (files.length && files.every((file) => DOCS_ONLY.test(file))) return null;
  if (verifiedAt(record, target)) return null;
  const done = record?.sha === target ? STEPS.filter((step) => record.passed?.[step]) : [];
  const short = target.slice(0, 9);
  return [
    `要合入的 ${short} 还没在固定提交上验证完（已过：${done.join("、") || "无"}）。`,
    `  先 pnpm mq:verify ${short}，全过了再 land；验的是别的提交就 --upto 到那个提交。`,
    "  只改了文档，或用户同意这批不验证时，加 --unverified。",
  ].join("\n");
}

function prepare(dir, sha, force) {
  const main = mainCheckoutOf();
  if (!existsSync(dir)) {
    console.log(`[verify] 第一次用，建验证目录 ${dir}（detached worktree）…`);
    git(["worktree", "add", "--detach", dir, sha], main);
  } else {
    const dirty = tryGit(["status", "--porcelain"], dir).out.split("\n").filter(Boolean);
    if (dirty.length && !force) {
      console.error(`[verify] 验证目录里有改动（多半是 --update-snapshots 写的快照），还没复制回主工作区：`);
      for (const line of dirty.slice(0, 20)) console.error(`  ${line}`);
      console.error(`  复制回去后加 --force 丢掉它们。`);
      return false;
    }
    git(["checkout", "--detach", "--force", sha], dir);
    if (force) tryGit(["clean", "-fdq"], dir);
  }
  console.log(`[verify] 验证目录停在 ${sha.slice(0, 9)}，安装依赖…`);
  const install = spawnSync(PNPM, ["install", "--frozen-lockfile"], { cwd: dir, stdio: ["ignore", "ignore", "inherit"] });
  return install.status === 0;
}

const HEARTBEAT_MS = 30_000;
const LAST_LINE_MAX = 90;

export function lastLineOf(text, previous = "") {
  const lines = text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").split(/[\r\n]+/).map((line) => line.trim()).filter(Boolean);
  const line = lines.at(-1);
  if (!line) return previous;
  return line.length > LAST_LINE_MAX ? `${line.slice(0, LAST_LINE_MAX - 1)}…` : line;
}

export function formatElapsed(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes}分${String(seconds % 60).padStart(2, "0")}秒` : `${seconds}秒`;
}

export function heartbeatLines(running, now = Date.now()) {
  return running.map(({ step, start, lastLine }) => `  … ${step} ${formatElapsed(now - start)}${lastLine ? ` · ${lastLine}` : ""}`);
}

function startHeartbeat(running) {
  const timer = setInterval(() => {
    const active = [...running.values()];
    if (active.length) console.log(heartbeatLines(active).join("\n"));
  }, HEARTBEAT_MS);
  timer.unref();
  return () => clearInterval(timer);
}

function runStep(step, dir, pages, logDir, running) {
  const [command, ...args] = COMMANDS[step];
  const file = path.join(logDir, `${step}.log`);
  const log = createWriteStream(file);
  const extra = step === "regression" ? pages : [];
  return new Promise((resolve) => {
    let output = "";
    const state = { step, start: Date.now(), lastLine: "" };
    running.set(step, state);
    console.log(`▶ ${step} 开始（日志 ${file}）`);
    const child = spawn(command === "pnpm" ? PNPM : command, [...args, ...extra], { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
    const take = (chunk) => {
      output += chunk;
      log.write(chunk);
      state.lastLine = lastLineOf(String(chunk), state.lastLine);
    };
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    child.on("close", (code) => {
      log.end();
      running.delete(step);
      const ok = code === 0;
      console.log(`${ok ? "✓" : "✗"} ${step} ${formatElapsed(Date.now() - state.start)}（日志 ${file}）`);
      if (!ok) for (const line of output.trimEnd().split("\n").slice(-12)) console.log(`    ${line}`);
      resolve({ step, ok, failedPages: step === "regression" ? failedPages(output) : [] });
    });
  });
}

export async function verifyCommand(args) {
  const request = verifyRequest(args);
  if (request.error) {
    console.error(`[verify] ${request.error}`);
    return 1;
  }
  const main = mainCheckoutOf();
  const found = tryGit(["rev-parse", "--verify", "--quiet", `${request.commit ?? INTEGRATION_BRANCH}^{commit}`], main);
  if (!found.ok || !found.out) {
    console.error(`[verify] 找不到提交 ${request.commit}。`);
    return 1;
  }
  const sha = found.out;
  const dir = verifyDirOf(main);
  if (!prepare(dir, sha, request.force)) return 1;
  const logDir = path.join(commonDir(main), "fuyu-verify-logs");
  mkdirSync(logDir, { recursive: true });
  console.log(`[verify] 在 ${sha.slice(0, 9)} 上跑 ${request.steps.join("、")}${request.pages.length ? `（页面：${request.pages.join(" ")}）` : ""}，并行，各自排队…`);
  const running = new Map();
  const stopHeartbeat = startHeartbeat(running);
  const results = await Promise.all(request.steps.map((step) => runStep(step, dir, request.pages, logDir, running)));
  stopHeartbeat();
  const previous = readRecord(main);
  const carry = Boolean(previous && previous.sha !== sha && tryGit(["merge-base", "--is-ancestor", previous.sha, sha], main).ok);
  const record = nextRecord(previous, { sha, carry, results, pages: request.pages });
  writeFileSync(recordFile(main), JSON.stringify(record, null, 2));
  if (carry) {
    const carried = STEPS.filter((step) => record.passed[step] && record.passed[step].sha !== sha);
    if (carried.length) console.log(`[verify] 沿用 ${previous.sha.slice(0, 9)} 上已过的：${carried.join("、")}（之后的提交只改了这次重跑的部分时才算数，拿不准就全跑）`);
  }
  if (verifiedAt(record, sha)) {
    console.log(`\n✓ ${sha.slice(0, 9)} 验证完了：pnpm mq:land --yes --upto ${sha.slice(0, 9)} --body <文件>`);
    return 0;
  }
  const missing = STEPS.filter((step) => !record.passed[step]);
  console.log(`\n[verify] ${sha.slice(0, 9)} 还差：${missing.join("、")}${record.failedPages.length ? `；挂的页：${record.failedPages.join(" ")}` : ""}`);
  console.log("  在主工作区修好、提交，再 pnpm mq:verify 验新的提交；只重跑挂的：--only <项> 或 --pages <词…>");
  return 1;
}
