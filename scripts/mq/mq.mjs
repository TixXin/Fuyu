import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkCommit } from "./checkCommit.mjs";
import { checkPush } from "./checkPush.mjs";
import { land, pendingCommits } from "./land.mjs";
import { INTEGRATION_BRANCH, tryGit } from "./settings.mjs";
import { sync } from "./sync.mjs";
import { waitCommand } from "./wait.mjs";

const BATCH_COMMITS = 5;
const BATCH_HOURS = 6;

export function batchAdvice(commits, now = Date.now()) {
  if (!commits.length) return { due: false, reason: "没有没推的提交" };
  const hours = (now - Math.min(...commits.map((commit) => commit.at))) / 3_600_000;
  if (commits.length >= BATCH_COMMITS) return { due: true, reason: `攒了 ${commits.length} 个提交` };
  if (hours >= BATCH_HOURS) return { due: true, reason: `最早的提交已经 ${Math.floor(hours)} 小时没推` };
  return { due: false, reason: `${commits.length} 个提交没推，最早的 ${Math.max(0, Math.round(hours * 60))} 分钟前` };
}

function pending() {
  tryGit(["fetch", "origin", INTEGRATION_BRANCH, "--quiet"]);
  const commits = pendingCommits();
  for (const { subject } of commits) console.log(`  ${subject}`);
  const { due, reason } = batchAdvice(commits);
  console.log(due ? `[pending] ${reason}，该提 PR 了：pnpm mq:land --body <文件>` : `[pending] ${reason}；一个功能做完、要给另一台机器用或发版前再提 PR`);
  return 0;
}

function option(args, name) {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] ?? "" : null;
}

export function listOption(args, name) {
  const at = args.indexOf(name);
  if (at < 0) return null;
  const rest = args.slice(at + 1);
  const end = rest.findIndex((arg) => arg.startsWith("--"));
  return end < 0 ? rest : rest.slice(0, end);
}

const COMMANDS = {
  land: (args) => land({ wait: args.includes("--wait"), bodyFile: option(args, "--body"), title: option(args, "--title"), only: listOption(args, "--only") }),
  wait: (args) => waitCommand(args),
  sync: () => sync(),
  pending,
  "check-push": () => checkPush(),
  "check-commit": () => checkCommit(),
};

export async function main(argv) {
  const run = COMMANDS[argv[0]];
  if (!run) {
    console.error(`用法：node scripts/mq/mq.mjs <${Object.keys(COMMANDS).join("|")}>`);
    return 1;
  }
  return run(argv.slice(1));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    console.error(`[mq] ${error.message}`);
    process.exitCode = 1;
  }
}
