import { spawn } from "node:child_process";
import { hostname } from "node:os";
import path from "node:path";
import { failedChecks, github as realGitHub, landBranchName } from "./github.mjs";
import { INTEGRATION_BRANCH, ON_LAND, git, tryGit } from "./settings.mjs";
import { sync } from "./sync.mjs";

const POLL_MS = 20_000;
const TIMEOUT_MS = 90 * 60_000;

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fireOnLand(commit, branch) {
  try {
    const child = spawn(process.execPath, ON_LAND, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: { ...process.env, CCMQ_LANDED_SHA: commit, CCMQ_INTEGRATION_BRANCH: INTEGRATION_BRANCH, CCMQ_LANE_BRANCH: branch },
    });
    child.unref();
  } catch {
    return;
  }
}

async function reportStranded() {
  try {
    const { strandedLines } = await import("../lanes/session-hint.mjs");
    for (const line of strandedLines(path.dirname(path.resolve(git(["rev-parse", "--git-common-dir"]))))) console.log(line);
  } catch {
    return;
  }
}

async function afterMerge(commit) {
  const branch = tryGit(["rev-parse", "--abbrev-ref", "HEAD"]).out.trim();
  sync();
  if (commit) fireOnLand(commit, branch);
  await reportStranded();
}

export async function waitFor(number, options = {}) {
  const { github = realGitHub, interval = POLL_MS, timeout = TIMEOUT_MS, sleep = pause, onMerged = afterMerge, updateBehind = true } = options;
  const deadline = Date.now() + timeout;
  console.log(`[wait] 等 PR #${number} 合入 ${INTEGRATION_BRANCH}…`);
  while (Date.now() < deadline) {
    const pr = github.view(number);
    if (pr.state === "MERGED") {
      console.log(`✓ PR #${number} 已合入 ${INTEGRATION_BRANCH}（${pr.mergeCommit?.oid?.slice(0, 8) ?? "?"}）。`);
      await onMerged(pr.mergeCommit?.oid ?? "");
      return 0;
    }
    if (pr.state === "CLOSED") {
      console.error(`[wait] PR #${number} 被关掉了，没有合入：${pr.url}`);
      return 1;
    }
    const failed = failedChecks(pr.statusCheckRollup);
    if (failed.length) {
      console.error(`[wait] PR #${number} 的检查没通过，自动合并会一直等着：`);
      for (const { name, url } of failed) console.error(`  ${name}  ${url}`);
      console.error("在同一个 lane 修好、提交，再 pnpm mq:land，PR 会自动更新。");
      return 1;
    }
    if (pr.mergeStateStatus === "DIRTY") {
      console.error(`[wait] PR #${number} 和 ${INTEGRATION_BRANCH} 冲突了。在 lane 里重新 pnpm mq:land（会先 rebase），按提示解决冲突。`);
      return 1;
    }
    if (pr.mergeStateStatus === "BEHIND" && updateBehind) {
      console.log(`[wait] PR #${number} 落后于 ${INTEGRATION_BRANCH}，更新分支后 CI 重跑…`);
      try {
        github.updateBranch(number);
      } catch (error) {
        console.error(`[wait] 更新分支失败：${`${error.stderr ?? error.message}`.trim()}`);
      }
    }
    await sleep(interval);
  }
  console.error(`[wait] 等了 ${Math.round(timeout / 60_000)} 分钟 PR #${number} 还没合入，自动合并仍开着。稍后再 pnpm mq:wait ${number}。`);
  return 1;
}

export async function waitCommand(args = [], { github = realGitHub, host = hostname() } = {}) {
  let number = Number(args.find((arg) => /^\d+$/.test(arg)));
  if (!number) {
    const branch = tryGit(["rev-parse", "--abbrev-ref", "HEAD"]).out.trim();
    const pr = github.findPr(landBranchName(github.login(), host, branch), "all");
    if (!pr) {
      console.error(`[wait] ${branch} 没有对应的 PR。先 pnpm mq:land，或者 pnpm mq:wait <PR 号>。`);
      return 1;
    }
    number = pr.number;
  }
  return waitFor(number, { github });
}
