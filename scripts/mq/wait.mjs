import { thisMachine } from "../machine-name.mjs";
import { mergedReminder } from "../tasks/taskIssues.mjs";
import { flakyReport } from "./flaky.mjs";
import { MAX_SHORTAGE_RERUNS, rerunStarved } from "./runnerShortage.mjs";
import { failedChecks, isNetworkError, github as realGitHub, landBranchName } from "./github.mjs";
import { INTEGRATION_BRANCH, tryGit } from "./settings.mjs";
import { sync } from "./sync.mjs";

const POLL_MS = 20_000;
const TIMEOUT_MS = 90 * 60_000;
const NETWORK_RETRIES = 5;
const RETRY_MS = 15_000;

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function afterMerge(oid) {
  tryGit(["fetch", "origin", INTEGRATION_BRANCH, "--quiet"]);
  sync();
  const root = tryGit(["rev-parse", "--show-toplevel"]).out.trim();
  for (const line of await mergedReminder(root, oid)) console.log(line.startsWith(" ") ? line : `[wait] ${line}`);
}

export async function waitFor(number, options = {}) {
  const { github = realGitHub, interval = POLL_MS, timeout = TIMEOUT_MS, sleep = pause, onMerged = afterMerge, updateBehind = false } = options;
  const { retries = NETWORK_RETRIES, retryInterval = RETRY_MS, flaky = flakyReport, shortage = rerunStarved } = options;
  const deadline = Date.now() + timeout;
  let misses = 0;
  let reruns = 0;
  console.log(`[wait] 等 PR #${number} 合入 ${INTEGRATION_BRANCH}…`);
  while (Date.now() < deadline) {
    let pr;
    try {
      pr = github.view(number);
      misses = 0;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      const reason = `${error.stderr ?? error.message}`.trim().split("\n")[0];
      misses += 1;
      if (misses > retries) {
        console.error(`[wait] 连续 ${misses} 次读不到 PR #${number} 的状态（${reason}），自动合并仍开着。网络好了再 pnpm mq:wait ${number}。`);
        return 1;
      }
      console.log(`[wait] 读 PR 状态时网络出错（${reason}），${Math.round(retryInterval / 1000)} 秒后重试（${misses}/${retries}）…`);
      await sleep(retryInterval);
      continue;
    }
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
    const starved = failed.length && reruns < MAX_SHORTAGE_RERUNS ? shortage(github, failed) : null;
    if (starved) {
      if (starved === "rerun") reruns += 1;
      await sleep(interval);
      continue;
    }
    if (failed.length) {
      console.error(`[wait] PR #${number} 的检查没通过，自动合并会一直等着：`);
      for (const { name, url } of failed) console.error(`  ${name}  ${url}`);
      for (const line of flaky(github, failed, { log: console.error })) console.error(line);
      console.error("修好、提交，再 pnpm mq:land --yes，PR 会自动更新。");
      return 1;
    }
    if (pr.mergeStateStatus === "DIRTY") {
      console.error(`[wait] PR #${number} 和 ${INTEGRATION_BRANCH} 冲突了。重新 pnpm mq:land --yes（会先把 origin/${INTEGRATION_BRANCH} 合进来），按提示解决冲突。`);
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

export function latestLandPr(github, { host, aliases = [] }, branch) {
  const login = github.login();
  const found = [host, ...aliases].map((name) => github.findPr(landBranchName(login, name, branch), "all")).filter(Boolean);
  return found.sort((a, b) => b.number - a.number)[0] ?? null;
}

export async function waitCommand(args = [], { github = realGitHub, machine = thisMachine() } = {}) {
  let number = Number(args.find((arg) => /^\d+$/.test(arg)));
  if (!number) {
    const branch = tryGit(["rev-parse", "--abbrev-ref", "HEAD"]).out.trim();
    const pr = latestLandPr(github, machine, branch);
    if (!pr) {
      console.error(`[wait] ${branch} 没有对应的 PR。先 pnpm mq:land --yes，或者 pnpm mq:wait <PR 号>。`);
      return 1;
    }
    number = pr.number;
  }
  return waitFor(number, { github, updateBehind: args.includes("--update") });
}
