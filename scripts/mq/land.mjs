import { spawnSync } from "node:child_process";
import { hostname } from "node:os";
import { github as realGitHub, landBranchName, prText } from "./github.mjs";
import { INTEGRATION_BRANCH, git, tryGit } from "./settings.mjs";
import { lockfileChanged } from "./sync.mjs";
import { waitFor } from "./wait.mjs";

export function landRefusal(branch, statusLines) {
  if (!branch || branch === "HEAD" || branch === INTEGRATION_BRANCH) return `land 只能在 lane 的分支上跑（现在是 '${branch || "?"}'）。`;
  const tracked = statusLines.filter((line) => line && !line.startsWith("??"));
  if (tracked.length) return `有没提交的改动，先提交再 land：\n${tracked.map((line) => `  ${line}`).join("\n")}`;
  return null;
}

function reinstallIfNeeded(before) {
  const changed = tryGit(["diff", "--name-only", before, "HEAD"]).out.split("\n");
  if (!lockfileChanged(changed)) return;
  console.log("[land] rebase 带进了锁文件的变化，先在 lane 里 pnpm install，检查才用得上新依赖");
  const result = spawnSync("pnpm", ["install"], { shell: process.platform === "win32", stdio: "inherit" });
  if (result.status !== 0) console.error("[land] pnpm install 失败，推送前的检查可能因为依赖不对而失败。");
}

export function laneCommits() {
  const out = tryGit(["log", "--reverse", "--format=%s%x1f%b%x1e", `origin/${INTEGRATION_BRANCH}..HEAD`]).out;
  return out.split("\x1e").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const [subject, body = ""] = entry.split("\x1f");
    return { subject: subject.trim(), body };
  });
}

function rebaseOntoMain() {
  git(["fetch", "origin", INTEGRATION_BRANCH, "--quiet"]);
  const before = git(["rev-parse", "HEAD"]);
  const rebase = spawnSync("git", ["rebase", `origin/${INTEGRATION_BRANCH}`], { stdio: "inherit" });
  if (rebase.status !== 0) {
    spawnSync("git", ["rebase", "--abort"], { stdio: "ignore" });
    console.error(`\n[land] rebase 到 origin/${INTEGRATION_BRANCH} 冲突，已中止，工作区是干净的。`);
    console.error(`自己 git fetch origin ${INTEGRATION_BRANCH} && git rebase origin/${INTEGRATION_BRANCH} 解决冲突后，再 pnpm mq:land。`);
    return false;
  }
  reinstallIfNeeded(before);
  return true;
}

function pushBranch(remoteBranch) {
  const ref = `refs/heads/${remoteBranch}`;
  const current = tryGit(["ls-remote", "origin", ref]).out.split(/\s+/)[0] ?? "";
  console.log(`[land] 推送到 ${remoteBranch}（检查在 pre-push 钩子里跑）…`);
  const push = spawnSync("git", ["push", `--force-with-lease=${ref}:${current}`, "origin", `HEAD:${ref}`], { stdio: "inherit" });
  return push.status === 0;
}

export async function land(options = {}) {
  const { github = realGitHub, host = hostname(), wait = false, waitOptions = {} } = options;
  const branch = tryGit(["rev-parse", "--abbrev-ref", "HEAD"]).out.trim();
  const refusal = landRefusal(branch, tryGit(["status", "--porcelain"]).out.split("\n"));
  if (refusal) {
    console.error(`[land] ${refusal}`);
    return 1;
  }
  if (!rebaseOntoMain()) return 1;
  const commits = laneCommits();
  if (!commits.length) {
    console.error(`[land] ${branch} 和 origin/${INTEGRATION_BRANCH} 一样，没有要合入的提交。`);
    return 1;
  }
  const remoteBranch = landBranchName(github.login(), host, branch);
  if (!pushBranch(remoteBranch)) {
    console.error(`\n[land] 推送 ${remoteBranch} 失败，见上面的输出。修好后重新 pnpm mq:land。`);
    return 1;
  }
  let pr = github.findPr(remoteBranch);
  if (pr) {
    console.log(`[land] PR #${pr.number} 已更新：${pr.url}`);
  } else {
    pr = github.createPr({ head: remoteBranch, base: INTEGRATION_BRANCH, ...prText(commits, branch) });
    console.log(`[land] 开了 PR #${pr.number}：${pr.url}`);
  }
  try {
    github.autoMerge(pr.number);
  } catch (error) {
    console.error(`[land] 没能开启自动合并：${`${error.stderr ?? error.message}`.trim()}`);
    console.error("仓库 Settings → General 里要打开 Allow auto-merge；也可以在 PR 页面上手动开启。");
    return 1;
  }
  console.log(`✓ PR #${pr.number} 已开启自动合并，CI 的 check 通过后 GitHub 自动合入 ${INTEGRATION_BRANCH}。`);
  if (wait) return waitFor(pr.number, { github, ...waitOptions });
  console.log("  后台运行 pnpm mq:wait 等结果：合入后快进主工作区；CI 失败或冲突时报告原因。");
  return 0;
}
