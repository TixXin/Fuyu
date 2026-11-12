import path from "node:path";
import { fileURLToPath } from "node:url";
import { mainCheckout } from "../build-dirs.mjs";
import { laneOf } from "./laneRegistry.mjs";
import { listLanes } from "./lanePool.mjs";

export function strandedFrom(lanes) {
  return lanes
    .filter((lane) => lane.work && lane.owner?.alive !== true && !lane.task && !lane.users?.length)
    .map((lane) => `⚠ lane ${lane.lane}（${lane.branch ?? "?"}）有没合入的工作（${lane.work}），登记的会话${lane.owner?.name ? ` ${lane.owner.name}` : ""}已经不在。问用户怎么处理，不要删。`);
}

export function strandedLines(main) {
  return strandedFrom(listLanes(main, {}, { probe: false }));
}

function inRepo(main, cwd) {
  if (laneOf(main, cwd) !== null) return true;
  const relative = path.relative(path.resolve(main), path.resolve(cwd));
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function hintFor(main, cwd) {
  if (laneOf(main, cwd) !== null) return null;
  const relative = path.relative(path.resolve(main), path.resolve(cwd));
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return [
    "[lanes] 这个会话的当前目录在主工作区。主工作区留给用户，开工前先开 lane 并进入它：",
    "  1. 在会话里调用 EnterWorktree（WorktreeCreate 钩子会分配 lane）；",
    "     或在主工作区运行 `pnpm lane:open --as <ListAgents 里自己的名字>`，再 EnterWorktree(path=<输出最后一行的路径>)。",
    "  2. 之后所有改动、提交和 `pnpm mq:land` 都在 lane 里做。细节见 docs/architecture/lanes.md。",
  ].join("\n");
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  let cwd = process.cwd();
  try {
    cwd = JSON.parse(await readStdin()).cwd ?? cwd;
  } catch {
    cwd = process.cwd();
  }
  try {
    const main = mainCheckout(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."));
    if (!inRepo(main, cwd)) return;
    const hint = hintFor(main, cwd);
    if (hint) console.log(hint);
    for (const line of strandedLines(main)) console.log(line);
  } catch {
    return;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
