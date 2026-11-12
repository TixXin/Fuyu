import { spawnSync } from "node:child_process";
import { CHECK_COMMAND, EMERGENCY_ENV, INTEGRATION_BRANCH, LANDING_ENV, git } from "./settings.mjs";

export function parseRefUpdates(stdin) {
  return stdin
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [localRef = "", localSha = "", remoteRef = "", remoteSha = ""] = line.split(/\s+/);
      return { localRef, localSha, remoteRef, remoteSha };
    });
}

export function pushBlock(updates, env) {
  if (env[EMERGENCY_ENV] === "1") return null;
  const main = `refs/heads/${INTEGRATION_BRANCH}`;
  if (updates.some((update) => update.remoteRef === main) && env[LANDING_ENV] !== "1") {
    return [
      "",
      `✋ 不能直接推送 ${INTEGRATION_BRANCH}，要经合并队列：在 lane 里 pnpm mq:land。`,
      `   紧急情况：${EMERGENCY_ENV}=1 git push …`,
      "",
    ].join("\n");
  }
  return null;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

export async function checkPush(env = process.env) {
  const updates = parseRefUpdates(await readStdin());
  if (!updates.length) {
    console.log("[check-push] 没有要推送的引用，跳过检查。");
    return 0;
  }
  if (env[EMERGENCY_ENV] === "1") console.log(`\n🚨 设了 ${EMERGENCY_ENV}，绕过合并队列。\n`);
  const block = pushBlock(updates, env);
  if (block) {
    console.error(block);
    return 1;
  }
  console.log(`[check-push] ${CHECK_COMMAND}`);
  const result = spawnSync(CHECK_COMMAND, { shell: true, stdio: "inherit", cwd: git(["rev-parse", "--show-toplevel"]) });
  return result.status ?? 1;
}
