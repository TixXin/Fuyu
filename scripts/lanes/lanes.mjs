// `pnpm lane:*`: lanes for sessions that do not go through the WorktreeCreate hook
// (EnterWorktree), and a view of who uses which lane. Rules: lanePool.mjs, laneState.mjs.
//
//   pnpm lane:open [--as <session>] [--no-install]   a lane for this session: its own idle
//                                                   one, else an idle one, else a new one
//   pnpm lane:take <N> [--as <session>] [--force]   take over lane N from another session
//   pnpm lane:release [N]                           this session no longer uses lane N
//   pnpm lane:list [--json]                         every lane, whose it is and why
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mainCheckout } from "../build-dirs.mjs";
import { claudePid, laneOf } from "./laneRegistry.mjs";
import { listLanes, openLane, releaseLane, takeLane } from "./lanePool.mjs";

function option(args, name) {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] ?? null : null;
}

function minutesAgo(ms, now = Date.now()) {
  if (!ms) return "—";
  const minutes = Math.round((now - ms) / 60000);
  return minutes < 120 ? `${minutes} 分钟前` : `${Math.round(minutes / 60)} 小时前`;
}

/** One line per lane for `lane:list`. */
export function listLine(entry, now = Date.now()) {
  const { owner } = entry;
  const alive = { true: "", false: "（已退出）", null: "（进程未知）" }[String(owner?.alive ?? null)];
  const who = owner ? `${owner.name ?? `pid ${owner.pid}`}${alive}` : "无记录";
  let state;
  if (!entry.worktree) state = "不是 worktree";
  else if (entry.work) state = `${entry.mine ? "你的 lane，" : ""}有工作：${entry.work}`;
  else if (entry.mine) state = "你的 lane";
  else if (entry.users.length) state = `在用：${entry.users.join("；")}`;
  else state = "空闲，可复用";
  return `${String(entry.lane).padStart(3)}  ${(entry.branch ?? "").padEnd(14)} ${who.padEnd(20)} 最近改动 ${minutesAgo(entry.lastActivityMs, now).padEnd(9)} ${state}`;
}

function main(argv) {
  const [command, ...args] = argv;
  const root = mainCheckout();
  const name = option(args, "--as");
  if (command === "open") {
    const lane = openLane({ main: root, fromCwd: process.cwd(), pid: claudePid(), name, install: !args.includes("--no-install") });
    console.log(`[lanes] lane ${lane.lane}（${lane.reused ? "复用" : "新建"}），已重置到主工作区的 HEAD。下一步在会话里用 EnterWorktree(path) 进入它：`);
    console.log(lane.wt);
    return 0;
  }
  if (command === "take") {
    const lane = Number(args[0]);
    if (!Number.isInteger(lane) || lane < 1) throw new Error("用法：pnpm lane:take <N> [--as <会话名>] [--force]");
    const entry = takeLane(root, lane, { pid: claudePid(), name, force: args.includes("--force") });
    console.log(`[lanes] lane ${lane} 记为${name ? ` ${name} ` : "这个会话"}在用：${entry.wt}${entry.work ? `（${entry.work}）` : ""}`);
    return 0;
  }
  if (command === "release") {
    const lane = args[0] ? Number(args[0]) : laneOf(root, process.cwd());
    if (!lane) throw new Error("用法：pnpm lane:release <N>（不在 lane 里时要写编号）");
    releaseLane(root, lane);
    console.log(`[lanes] lane ${lane} 不再记为谁在用`);
    return 0;
  }
  if (command === "list" || !command) {
    const lanes = listLanes(root, { pid: claudePid(), name, fromLane: laneOf(root, process.cwd()) });
    if (args.includes("--json")) console.log(JSON.stringify(lanes, null, 2));
    else if (!lanes.length) console.log("[lanes] 没有 lane");
    else for (const entry of lanes) console.log(listLine(entry));
    return 0;
  }
  throw new Error(`未知命令 ${command}；见 scripts/lanes/lanes.mjs 开头的说明`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`[lanes] ${error.message}`);
    process.exitCode = 1;
  }
}
