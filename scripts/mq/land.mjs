import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { hostname } from "node:os";
import { github as realGitHub, landBranchName, prText } from "./github.mjs";
import { INTEGRATION_BRANCH, git, tryGit } from "./settings.mjs";
import { lockfileChanged } from "./sync.mjs";
import { waitFor } from "./wait.mjs";

export function landRefusal(branch) {
  if (!branch || branch === "HEAD") return "现在不在任何分支上（detached HEAD），切回 main 或自己的分支再 land。";
  return null;
}

export function uncommittedNote(statusLines) {
  const tracked = statusLines.filter((line) => line && !line.startsWith("??"));
  return tracked.length ? `工作区里有 ${tracked.length} 个没提交的改动（可能是别的会话正在改的），这次不会带上。` : null;
}

function reinstallIfNeeded(before) {
  const changed = tryGit(["diff", "--name-only", before, "HEAD"]).out.split("\n");
  if (!lockfileChanged(changed)) return;
  console.log("[land] 合进来的 main 改了锁文件，先 pnpm install，检查才用得上新依赖");
  const result = spawnSync("pnpm", ["install"], { shell: process.platform === "win32", stdio: "inherit" });
  if (result.status !== 0) console.error("[land] pnpm install 失败，推送前的检查可能因为依赖不对而失败。");
}

export function pendingCommits(base = `origin/${INTEGRATION_BRANCH}`) {
  const out = tryGit(["log", "--reverse", "--no-merges", "--format=%s%x1f%ct%x1f%b%x1e", `${base}..HEAD`]).out;
  return out.split("\x1e").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const [subject, time = "0", body = ""] = entry.split("\x1f");
    return { subject: subject.trim(), at: Number(time) * 1000, body };
  });
}

function mergeOutsideWorkTree(upstream) {
  const tree = tryGit(["merge-tree", "--write-tree", "HEAD", upstream]);
  if (!tree.ok) return null;
  const made = tryGit(["commit-tree", tree.out.split("\n")[0], "-p", "HEAD", "-p", upstream, "-m", `Merge remote-tracking branch '${upstream}'`]);
  return made.ok ? made.out : null;
}

export function mergeMain() {
  git(["fetch", "origin", INTEGRATION_BRANCH, "--quiet"]);
  const upstream = `origin/${INTEGRATION_BRANCH}`;
  if (tryGit(["merge-base", "--is-ancestor", upstream, "HEAD"]).ok) return "HEAD";
  const before = git(["rev-parse", "HEAD"]);
  console.log(`[land] 先把 ${upstream} 合进来（merge，不改写已有的提交）…`);
  const merge = spawnSync("git", ["merge", "--no-edit", upstream], { stdio: "inherit" });
  if (merge.status === 0) {
    reinstallIfNeeded(before);
    return "HEAD";
  }
  spawnSync("git", ["merge", "--abort"], { stdio: "ignore" });
  const merged = mergeOutsideWorkTree(upstream);
  if (merged) {
    console.log(`\n[land] 工作区里没提交的文件挡住了合并，两边的提交本身不冲突：改在仓库内部合并（${merged.slice(0, 8)}），工作区和本地 ${INTEGRATION_BRANCH} 都没动。`);
    console.log(`  本地 ${INTEGRATION_BRANCH} 等 PR 合入、那些文件提交后由 pnpm mq:wait / pnpm mq:sync 跟上。`);
    return merged;
  }
  console.error(`\n[land] 合 ${upstream} 时冲突，已撤回这次合并。`);
  console.error(`自己 git merge ${upstream} 解决冲突、提交后，再 pnpm mq:land。`);
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

function changedFiles() {
  return tryGit(["diff", "--name-only", `origin/${INTEGRATION_BRANCH}...HEAD`]).out.split("\n").filter(Boolean);
}

export async function land(options = {}) {
  const { github = realGitHub, host = hostname(), wait = false, waitOptions = {}, bodyFile = null, title = null } = options;
  const branch = tryGit(["rev-parse", "--abbrev-ref", "HEAD"]).out.trim();
  const refusal = landRefusal(branch);
  if (refusal) {
    console.error(`[land] ${refusal}`);
    return 1;
  }
  const { body, error } = readBody(bodyFile);
  if (error) {
    console.error(`[land] ${error}`);
    return 1;
  }
  const note = uncommittedNote(tryGit(["status", "--porcelain"]).out.split("\n"));
  if (note) console.log(`[land] ${note}`);
  const rev = mergeMain();
  if (!rev) return 1;
  const commits = pendingCommits();
  if (!commits.length) {
    console.error(`[land] ${branch} 上没有 origin/${INTEGRATION_BRANCH} 之外的提交，没有要合入的。`);
    return 1;
  }
  const remoteBranch = landBranchName(github.login(), host, branch);
  if (!pushBranch(remoteBranch, rev)) {
    console.error(`\n[land] 推送 ${remoteBranch} 失败，见上面的输出。修好后重新 pnpm mq:land。`);
    return 1;
  }
  const text = prText(commits, branch, { title, body, files: changedFiles() });
  let pr = github.findPr(remoteBranch);
  if (pr) {
    if (body || title) github.editPr({ number: pr.number, ...text });
    console.log(`[land] PR #${pr.number} 已更新${body || title ? "（标题和正文也换成了这次给的）" : ""}：${pr.url}`);
  } else {
    pr = github.createPr({ head: remoteBranch, base: INTEGRATION_BRANCH, ...text });
    console.log(`[land] 开了 PR #${pr.number}：${pr.url}`);
    if (!body) console.log("  没给 --body，正文是从提交自动生成的骨架；补中文说明：写好文件后 pnpm mq:land --body <文件>");
  }
  try {
    github.autoMerge(pr.number);
  } catch (error) {
    console.error(`[land] 没能开启自动合并：${`${error.stderr ?? error.message}`.trim()}`);
    console.error("仓库 Settings → General 里要打开 Allow auto-merge；也可以在 PR 页面上手动开启。");
    return 1;
  }
  console.log(`✓ PR #${pr.number}（${commits.length} 个提交）已开启自动合并，CI 的 check 通过后 GitHub 自动合入 ${INTEGRATION_BRANCH}。`);
  if (wait) return waitFor(pr.number, { github, ...waitOptions });
  console.log("  后台运行 pnpm mq:wait 等结果：合入后把本地 main 跟上；CI 失败或冲突时报告原因。");
  return 0;
}
