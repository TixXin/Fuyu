import path from "node:path";
import { fileURLToPath } from "node:url";
import { mainCheckout } from "../build-dirs.mjs";
import { laneOf, lanePath, readOwners } from "./laneRegistry.mjs";
import { finishLane } from "./lanePool.mjs";

const KEEP_REASONS = new Set(["clear", "resume"]);

export function scriptMain(scriptFile = fileURLToPath(import.meta.url)) {
  return mainCheckout(path.resolve(path.dirname(scriptFile), "..", ".."));
}

export function lanesToFinish({ main, cwd, reason, session = null, pid = null, owners }) {
  if (KEEP_REASONS.has(reason)) return [];
  const lanes = new Set();
  const current = cwd ? laneOf(main, cwd) : null;
  if (current) lanes.add(current);
  for (const [key, owner] of Object.entries(owners)) {
    const lane = laneOf(main, key);
    if (!lane || key !== path.resolve(lanePath(main, lane)).toLowerCase()) continue;
    const bySession = Boolean(session && owner?.session === session);
    const byPid = Boolean(!owner?.session && pid && owner?.pid === pid);
    if (bySession || byPid) lanes.add(lane);
  }
  return [...lanes].sort((a, b) => a - b);
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  let input = {};
  try {
    input = JSON.parse(await readStdin());
  } catch {
    input = {};
  }
  try {
    const root = scriptMain();
    const lanes = lanesToFinish({
      main: root,
      cwd: input.cwd ?? null,
      reason: input.reason,
      session: input.session_id ?? process.env.CLAUDE_CODE_SESSION_ID ?? null,
      pid: Number(process.env.CLAUDE_PID) || null,
      owners: readOwners(root),
    });
    for (const lane of lanes) {
      const result = finishLane(root, lane);
      console.error(result.released ? `[lanes] lane ${lane} 已释放` : `[lanes] lane ${lane} 有没合入的工作，保留：${result.problems.join("；")}`);
    }
  } catch {
    return;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
