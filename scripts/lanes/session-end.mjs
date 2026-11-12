import path from "node:path";
import { fileURLToPath } from "node:url";
import { mainCheckout } from "../build-dirs.mjs";
import { claudePid, laneOf, lanePath, readOwners } from "./laneRegistry.mjs";
import { finishLane } from "./lanePool.mjs";

export function lanesToFinish({ main, cwd, reason, pid, owners }) {
  if (reason === "clear") return [];
  const lanes = new Set();
  const current = laneOf(main, cwd);
  if (current) lanes.add(current);
  if (pid) {
    for (const [key, owner] of Object.entries(owners)) {
      const lane = laneOf(main, key);
      if (lane && owner?.pid === pid && key === path.resolve(lanePath(main, lane)).toLowerCase()) lanes.add(lane);
    }
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
  const cwd = input.cwd ?? process.cwd();
  try {
    const root = mainCheckout(cwd);
    for (const lane of lanesToFinish({ main: root, cwd, reason: input.reason, pid: claudePid(), owners: readOwners(root) })) {
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
