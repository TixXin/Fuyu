import { spawnSync } from "node:child_process";
import { machineName } from "../machine-name.mjs";
import { github as realGitHub, landBranchName } from "./github.mjs";
import { INTEGRATION_BRANCH, git, tryGit } from "./settings.mjs";
import { mergedWith } from "./upto.mjs";

export function tryBranchName(login, host, branch) {
  return landBranchName(login, host, branch).replace(/^land\//, "try/");
}

function watchRun(branch, sha) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const list = spawnSync("gh", ["run", "list", "--branch", branch, "--limit", "5", "--json", "databaseId,headSha", "-q", `.[] | select(.headSha == "${sha}") | .databaseId`], { encoding: "utf8" });
    const found = list.stdout?.trim().split("\n")[0];
    if (found) return spawnSync("gh", ["run", "watch", found, "--exit-status"], { stdio: "inherit" }).status ?? 1;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
  }
  console.error(`[try] CI 还没在 ${branch} 上跑起来，稍后用 gh run list --branch ${branch} 看。`);
  return 1;
}

export function tryCi({ github = realGitHub, host = machineName(), wait = false } = {}) {
  const branch = tryGit(["rev-parse", "--abbrev-ref", "HEAD"]).out.trim();
  if (!branch || branch === "HEAD") {
    console.error("[try] 现在不在任何分支上（detached HEAD）。");
    return 1;
  }
  git(["fetch", "origin", INTEGRATION_BRANCH, "--quiet"]);
  const upstream = `origin/${INTEGRATION_BRANCH}`;
  const { rev, conflicts } = mergedWith("HEAD", upstream);
  if (!rev) {
    console.error(`[try] 本地 ${branch} 和 ${upstream} 冲突${conflicts.length ? `：${conflicts.join("、")}` : ""}，先 pnpm mq:sync 或手动合并。`);
    return 1;
  }
  const remoteBranch = tryBranchName(github.login(), host, branch);
  console.log(`[try] 把本地 ${branch}（合上 ${upstream}，${rev.slice(0, 8)}）推到 ${remoteBranch}，只跑 CI，不开 PR…`);
  const push = spawnSync("git", ["push", "--force", "origin", `${rev}:refs/heads/${remoteBranch}`], { stdio: "inherit" });
  if (push.status !== 0) {
    console.error("[try] 推送失败，见上面的输出。");
    return 1;
  }
  console.log(`✓ CI 在 ${remoteBranch} 上跑，Windows 和 macOS 的检查和 PR 上一样；同一台机器再推一次会取消上一轮。`);
  if (!wait) {
    console.log(`  看结果：gh run list --branch ${remoteBranch}；或者 pnpm mq:try --wait 在前台等。`);
    return 0;
  }
  return watchRun(remoteBranch, rev);
}
