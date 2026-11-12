import path from "node:path";
import { fileURLToPath } from "node:url";
import { failedChecks, github as realGitHub } from "./github.mjs";
import { INTEGRATION_BRANCH } from "./settings.mjs";

export function queueOrder(prs) {
  return prs
    .filter((pr) => !pr.isDraft && pr.autoMergeRequest)
    .filter((pr) => pr.mergeable !== "CONFLICTING" && !failedChecks(pr.statusCheckRollup).length)
    .sort((a, b) => a.autoMergeRequest.enabledAt.localeCompare(b.autoMergeRequest.enabledAt) || a.number - b.number);
}

export function updateBehind({ github = realGitHub, log = console.log } = {}) {
  const [next, ...waiting] = queueOrder(github.openPrs());
  if (!next) {
    log("[update-behind] 没有开着自动合并、能合入的 PR。");
    return 0;
  }
  const behind = github.behindBy(github.mainSha(INTEGRATION_BRANCH), next.headRefOid);
  if (!behind) {
    log(`[update-behind] 排在最前的 PR #${next.number} 已经基于最新的 ${INTEGRATION_BRANCH}，等它的 CI 和合入；后面还有 ${waiting.length} 个。`);
    return 0;
  }
  log(`[update-behind] 排在最前的 PR #${next.number} 落后 ${INTEGRATION_BRANCH} ${behind} 个提交，更新它的分支；后面还有 ${waiting.length} 个。`);
  try {
    github.updateBranch(next.number);
  } catch (error) {
    log(`[update-behind] 更新 PR #${next.number} 失败：${`${error.stderr ?? error.message}`.trim()}`);
    return 1;
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = updateBehind();
}
