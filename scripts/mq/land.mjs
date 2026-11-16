import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { machineName } from "../machine-name.mjs";
import { github as realGitHub, landBranchName, prText } from "./github.mjs";
import { pickOnto } from "./pick.mjs";
import { mergedWith, uptoRev } from "./upto.mjs";
import { INTEGRATION_BRANCH, git, tryGit } from "./settings.mjs";
import { landBusyNote, takeLandLock } from "./landLock.mjs";
import { waitFor } from "./wait.mjs";

export function landRefusal(branch) {
  if (!branch || branch === "HEAD") return "现在不在任何分支上（detached HEAD），切回 main 或自己的分支再 land。";
  return null;
}

export function uncommittedNote(statusLines) {
  const tracked = statusLines.filter((line) => line && !line.startsWith("??"));
  return tracked.length ? `工作区里有 ${tracked.length} 个没提交的改动（可能是别的会话正在改的），这次不会带上。` : null;
}

function patchIds(range) {
  const log = spawnSync("git", ["log", "--no-merges", "-p", "--no-color", "--no-ext-diff", ...range], { maxBuffer: 1 << 30 });
  if (log.status !== 0) return new Map();
  const ids = spawnSync("git", ["patch-id", "--stable"], { input: log.stdout, encoding: "utf8", maxBuffer: 1 << 26 });
  return new Map(ids.stdout.split("\n").filter(Boolean).map((line) => line.split(" ").reverse()));
}

export function pendingCommits(base = `origin/${INTEGRATION_BRANCH}`, head = "HEAD") {
  const out = tryGit(["log", "--reverse", "--no-merges", "--format=%H%x1f%s%x1f%ct%x1f%b%x1e", `${base}..${head}`]).out;
  const commits = out.split("\x1e").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const [sha, subject = "", time = "0", body = ""] = entry.split("\x1f");
    return { sha, subject: subject.trim(), at: Number(time) * 1000, body };
  });
  if (!commits.length) return [];
  const fork = tryGit(["rev-parse", "--verify", "--quiet", `${commits[0].sha}^`]);
  const landed = new Set(patchIds([fork.ok && fork.out ? `${fork.out}..${base}` : base]).values());
  const mine = landed.size ? patchIds([`${base}..${head}`]) : new Map();
  return commits.filter(({ sha }) => !landed.has(mine.get(sha))).map(({ subject, at, body }) => ({ subject, at, body }));
}

export function mergeMain() {
  git(["fetch", "origin", INTEGRATION_BRANCH, "--quiet"]);
  const upstream = `origin/${INTEGRATION_BRANCH}`;
  if (tryGit(["merge-base", "--is-ancestor", upstream, "HEAD"]).ok) return "HEAD";
  const { rev: merged, conflicts } = mergedWith("HEAD", upstream);
  if (merged) {
    console.log(`[land] 在仓库内部把 ${upstream} 合进来（${merged.slice(0, 8)}），工作区、暂存区和本地 ${INTEGRATION_BRANCH} 都没动。`);
    console.log(`  本地 ${INTEGRATION_BRANCH} 等 PR 合入后由 pnpm mq:wait / pnpm mq:sync 跟上。`);
    return merged;
  }
  console.error(`\n[land] 本地的提交和 ${upstream} 冲突，什么都没动。`);
  if (conflicts.length) console.error(`  冲突的文件：${conflicts.join("、")}`);
  console.error(`  git status 里没有别人没提交的已跟踪文件时，才能自己 git merge ${upstream} 解决冲突、提交，再 pnpm mq:land --yes；`);
  console.error("  工作区里有别人的改动时不要 git merge，失败时它会 reset --hard 冲掉那些改动（#688），先找改那些文件的会话或全局总控。");
  return null;
}

function pushBranch(remoteBranch, rev) {
  const ref = `refs/heads/${remoteBranch}`;
  const current = tryGit(["ls-remote", "origin", ref]).out.split(/\s+/)[0] ?? "";
  console.log(`[land] 推送到 ${remoteBranch}（检查在 pre-push 钩子里跑）…`);
  const push = spawnSync("git", ["push", `--force-with-lease=${ref}:${current}`, "origin", `${rev}:${ref}`], { stdio: "inherit" });
  return push.status === 0;
}

function readBody(file) {
  if (!file) return { body: null };
  if (!existsSync(file)) return { error: `--body 指定的文件不存在：${file}` };
  const body = readFileSync(file, "utf8");
  return body.trim() ? { body } : { error: `--body 指定的文件是空的：${file}` };
}

function changedFiles(head = "HEAD") {
  return tryGit(["diff", "--name-only", `origin/${INTEGRATION_BRANCH}...${head}`]).out.split("\n").filter(Boolean);
}

function pickOnly(only) {
  git(["fetch", "origin", INTEGRATION_BRANCH, "--quiet"]);
  const { tip, picked = [], skipped = [], error } = pickOnto(`origin/${INTEGRATION_BRANCH}`, only);
  if (error) {
    console.error(`[land] ${error}`);
    return null;
  }
  for (const line of skipped) console.log(`[land] ${line} 的内容已经在 origin/${INTEGRATION_BRANCH} 上，跳过。`);
  if (!picked.length) {
    console.error(`[land] 指定的提交都已经在 ${INTEGRATION_BRANCH} 上，没有要合入的。`);
    return null;
  }
  console.log(`[land] 只带 ${picked.length} 个提交，在仓库内部叠到 origin/${INTEGRATION_BRANCH} 上（${tip.slice(0, 8)}），工作区和本地 ${INTEGRATION_BRANCH} 都没动。`);
  return { rev: tip, suffix: `-only-${picked[0].slice(0, 7)}` };
}

function pickUpto(name) {
  git(["fetch", "origin", INTEGRATION_BRANCH, "--quiet"]);
  const { rev, sha, carried, error } = uptoRev(name);
  if (error) {
    console.error(`[land] ${error}`);
    return null;
  }
  console.log(`[land] 带上本地 ${INTEGRATION_BRANCH} 到 ${sha.slice(0, 8)} 为止的 ${carried} 个提交，提交号不变（${rev.slice(0, 8)}），工作区和本地 ${INTEGRATION_BRANCH} 都没动。`);
  return { rev, suffix: `-upto-${sha.slice(0, 7)}` };
}

export async function land(options = {}) {
  const { github = realGitHub, wait = false, waitOptions = {}, only = null, upto = null, lock = takeLandLock } = options;
  if (only || upto) return finish(await landOnce(options), { wait, github, waitOptions });
  const held = lock();
  if (!held.ok) {
    console.log(landBusyNote(held.holder));
    return 0;
  }
  let result;
  try {
    result = await landOnce(options);
  } finally {
    held.release();
  }
  return finish(result, { wait, github, waitOptions });
}

function finish({ code, pr }, { wait, github, waitOptions }) {
  if (code !== 0 || !wait || !pr) return code;
  return waitFor(pr, { github, ...waitOptions });
}

async function landOnce(options) {
  const fail = { code: 1 };
  const { github = realGitHub, host = machineName(), wait = false, bodyFile = null, title = null, only = null, upto = null } = options;
  const branch = tryGit(["rev-parse", "--abbrev-ref", "HEAD"]).out.trim();
  const refusal = landRefusal(branch);
  if (refusal) {
    console.error(`[land] ${refusal}`);
    return fail;
  }
  const { body, error } = readBody(bodyFile);
  if (error) {
    console.error(`[land] ${error}`);
    return fail;
  }
  const note = uncommittedNote(tryGit(["status", "--porcelain"]).out.split("\n"));
  if (note) console.log(`[land] ${note}`);
  const chosen = only ? pickOnly(only) : upto ? pickUpto(upto) : null;
  if ((only || upto) && !chosen) return fail;
  const rev = chosen ? chosen.rev : mergeMain();
  if (!rev) return fail;
  const commits = pendingCommits(undefined, rev);
  if (!commits.length) {
    console.error(`[land] ${branch} 上没有 origin/${INTEGRATION_BRANCH} 之外的提交，没有要合入的。`);
    return fail;
  }
  const remoteBranch = `${landBranchName(github.login(), host, branch)}${chosen?.suffix ?? ""}`;
  if (!pushBranch(remoteBranch, rev)) {
    console.error(`\n[land] 推送 ${remoteBranch} 失败，见上面的输出。修好后重新 pnpm mq:land --yes。`);
    return fail;
  }
  const text = prText(commits, branch, { title, body, files: changedFiles(rev) });
  let pr = github.findPr(remoteBranch);
  if (pr) {
    if (body || title) github.editPr({ number: pr.number, ...text });
    console.log(`[land] PR #${pr.number} 已更新${body || title ? "（标题和正文也换成了这次给的）" : ""}：${pr.url}`);
  } else {
    pr = github.createPr({ head: remoteBranch, base: INTEGRATION_BRANCH, ...text });
    console.log(`[land] 开了 PR #${pr.number}：${pr.url}`);
    if (!body) console.log("  没给 --body，正文是从提交自动生成的骨架；补中文说明：写好文件后 pnpm mq:land --yes --body <文件>");
  }
  try {
    github.autoMerge(pr.number);
  } catch (error) {
    console.error(`[land] 没能开启自动合并：${`${error.stderr ?? error.message}`.trim()}`);
    console.error("仓库 Settings → General 里要打开 Allow auto-merge；也可以在 PR 页面上手动开启。");
    return fail;
  }
  console.log(`✓ PR #${pr.number}（${commits.length} 个提交）已开启自动合并，CI 的 check 通过后 GitHub 自动合入 ${INTEGRATION_BRANCH}。`);
  if (!wait) console.log(`  后台运行 pnpm mq:wait${chosen ? ` ${pr.number}` : ""} 等结果：合入后把本地 main 跟上；CI 失败或冲突时报告原因。`);
  return { code: 0, pr: pr.number };
}
