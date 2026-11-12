import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { createQueueLock } from "./queueLock.mjs";
import { INTEGRATION_BRANCH, LANDING_ENV, ON_LAND, dataDir, git, tryGit } from "./settings.mjs";
import { lockfileChanged, sync } from "./sync.mjs";

export function landRefusal(branch, statusLines) {
  if (!branch || branch === "HEAD" || branch === INTEGRATION_BRANCH) return `land 只能在 lane 的分支上跑（现在是 '${branch || "?"}'）。`;
  const tracked = statusLines.filter((line) => line && !line.startsWith("??"));
  if (tracked.length) return `有没提交的改动，先提交再 land：\n${tracked.map((line) => `  ${line}`).join("\n")}`;
  return null;
}

function waitMessage(branch) {
  return ({ ahead, holder, stuckMs }) => {
    if (ahead > 0) console.log(`[land-queue] ${branch}: 前面还有 ${ahead} 个在 land，排队中…`);
    else if (stuckMs) console.log(`⚠ [land-queue] ${branch}: '${holder.label}'（pid ${holder.pid}）已经占着队列约 ${Math.round(stuckMs / 60000)} 分钟；卡死了就查一下这个进程。`);
    else if (holder) console.log(`[land-queue] ${branch}: 下一个就是你，等 '${holder.label}' land 完…`);
  };
}

function reinstallIfNeeded(before) {
  const changed = tryGit(["diff", "--name-only", before, "HEAD"]).out.split("\n");
  if (!lockfileChanged(changed)) return;
  console.log("[land] rebase 带进了锁文件的变化，先在 lane 里 pnpm install，检查才用得上新依赖");
  const result = spawnSync("pnpm", ["install"], { shell: process.platform === "win32", stdio: "inherit" });
  if (result.status !== 0) console.error("[land] pnpm install 失败，下面的检查可能因为依赖不对而失败。");
}

function fireOnLand(info) {
  try {
    const child = spawn(process.execPath, ON_LAND, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: { ...process.env, CCMQ_LANDED_SHA: info.commit, CCMQ_INTEGRATION_BRANCH: INTEGRATION_BRANCH, CCMQ_LANE_BRANCH: info.branch },
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

export async function land() {
  const branch = tryGit(["rev-parse", "--abbrev-ref", "HEAD"]).out.trim();
  const refusal = landRefusal(branch, tryGit(["status", "--porcelain"]).out.split("\n"));
  if (refusal) {
    console.error(`[land] ${refusal}`);
    return 1;
  }
  const lock = createQueueLock(path.join(dataDir(), "land-queue"), { label: branch });
  await lock.acquire({ onWait: waitMessage(branch) });
  let landed = null;
  try {
    console.log(`[land-queue] ${branch}: 轮到了，开始 land`);
    git(["fetch", "origin", INTEGRATION_BRANCH, "--quiet"]);
    const before = git(["rev-parse", "HEAD"]);
    const rebase = spawnSync("git", ["rebase", `origin/${INTEGRATION_BRANCH}`], { stdio: "inherit" });
    if (rebase.status !== 0) {
      spawnSync("git", ["rebase", "--abort"], { stdio: "ignore" });
      console.error(`\n[land] rebase 到 origin/${INTEGRATION_BRANCH} 冲突，已中止，工作区是干净的。`);
      console.error(`自己 git fetch origin ${INTEGRATION_BRANCH} && git rebase origin/${INTEGRATION_BRANCH} 解决冲突后，再 pnpm mq:land。`);
      return 1;
    }
    reinstallIfNeeded(before);
    const commit = git(["rev-parse", "HEAD"]);
    console.log(`[land] 推送到 ${INTEGRATION_BRANCH}（检查在 pre-push 钩子里跑）…`);
    const push = spawnSync("git", ["push", "origin", `HEAD:${INTEGRATION_BRANCH}`], { stdio: "inherit", env: { ...process.env, [LANDING_ENV]: "1" } });
    if (push.status !== 0) {
      console.error(`\n[land] 推送到 ${INTEGRATION_BRANCH} 失败，见上面的输出。修好后重新 pnpm mq:land。`);
      return 1;
    }
    console.log(`✓ ${branch} landed on ${INTEGRATION_BRANCH}.`);
    landed = { commit, branch };
    sync();
    await reportStranded();
    return 0;
  } finally {
    lock.release();
    if (landed) fireOnLand(landed);
  }
}
