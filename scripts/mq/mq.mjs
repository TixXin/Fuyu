import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkCommit } from "./checkCommit.mjs";
import { checkPush } from "./checkPush.mjs";
import { commitPart } from "./commitPart.mjs";
import { land, pendingCommits } from "./land.mjs";
import { INTEGRATION_BRANCH, tryGit } from "./settings.mjs";
import { sync } from "./sync.mjs";
import { tryCi } from "./try.mjs";
import { waitCommand } from "./wait.mjs";

const BATCH_COMMITS = 10;

export function batchAdvice(commits, now = Date.now()) {
  if (!commits.length) return { due: false, reason: "没有没推的提交" };
  if (commits.length >= BATCH_COMMITS) return { due: true, reason: `攒了 ${commits.length} 个提交` };
  const minutes = (now - Math.min(...commits.map((commit) => commit.at))) / 60_000;
  return { due: false, reason: `${commits.length} 个提交没推，最早的 ${Math.max(0, Math.round(minutes))} 分钟前` };
}

function pending() {
  tryGit(["fetch", "origin", INTEGRATION_BRANCH, "--quiet"]);
  const commits = pendingCommits();
  for (const { subject } of commits) console.log(`  ${subject}`);
  const { due, reason } = batchAdvice(commits);
  console.log(due ? `[pending] ${reason}，该提 PR 了：pnpm mq:land --yes --body <文件>` : `[pending] ${reason}；一个任务做完、要给另一台机器用或发版前再提 PR`);
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

const LAND_OPTIONS = ["--yes", "--wait", "--body", "--title", "--only", "--urgent", "--upto"];

const HELP = [
  "用法：node scripts/mq/mq.mjs <命令> [参数]",
  "",
  "  pending                 列出本地还没推的提交，说到没到该提 PR 的时候",
  "  land --yes [参数]       把本地提交推到 land/ 分支、开 PR 并开启自动合并；不写 --yes 不会推",
  "      --body <文件>       中文 PR 正文",
  "      --title <标题>      英文 PR 标题，默认取第一个提交的标题",
  "      --upto <提交号>     只带本地 main 上到这个提交为止的提交，提交号不变，开单独的 PR",
  "      --only <提交号…> --urgent   紧急修复：只把这几个提交重新叠到 main 上；提交号会变，本地 main 之后要多合一次",
  "      --wait              在前台等到合入",
  "  wait [PR 号] [--update]  等 PR 合入，把本地 main 跟上；--update 在它落后时更新分支",
  "  sync                    把 origin/main 合进本地 main；挡路的没提交文件能三方合并就照样跟上",
  "  try [--wait]            把本地 main（合上 origin/main）推到 try/ 分支只跑 CI，不开 PR，提前看 Windows 的结果；--wait 等到结果后删掉这个分支",
  "  try --clean             删掉本机推的、CI 已经跑完的 try/ 分支；别的机器的、还在跑的只列出来",
  "  commit-part --list <文件…>   列出文件相对 HEAD 的每一处改动和编号",
  "  commit-part -m <标题> [-F <说明文件>] …   同一个文件里只提交自己的改动，不动工作区",
  "      --take <文件>:<编号,…>       只带这几处",
  "      --match <文件>:<正则>        只带增删的行匹配正则的那几处",
  "      --as <文件>=<准备好的文件>   两个人的改动挨在一起时，直接给出要提交的内容",
  "      -- <整个文件…>              这些文件整个带上，新增、删除、改名的两头都写",
  "      --dry-run                   只显示会提交什么",
  "  check-push、check-commit  git 钩子用",
  "",
  "任何命令带 --help 或 -h，以及不带参数的 land、commit-part，都只显示这份说明。",
].join("\n");

export function landRequest(args) {
  if (!args.length) return { help: true };
  const unknown = args.find((arg) => arg.startsWith("-") && !LAND_OPTIONS.includes(arg));
  if (unknown) return { error: `land 不认识参数 ${unknown}。` };
  if (!args.includes("--yes")) return { error: "land 会推送并开 PR，确认要推就加上 --yes。" };
  const only = listOption(args, "--only");
  const upto = option(args, "--upto");
  if (only && !args.includes("--urgent")) return { error: "--only 把提交重新做一份，提交号变了，本地 main 之后合 origin/main 会冲突。先合入前面的提交用 --upto <提交号>；确实是紧急修复再加 --urgent。" };
  if (only && upto !== null) return { error: "--only 和 --upto 只能用一个。" };
  if (upto === "") return { error: "--upto 后面要写提交号。" };
  return { options: { wait: args.includes("--wait"), bodyFile: option(args, "--body"), title: option(args, "--title"), only, upto } };
}

function landCommand(args) {
  const request = landRequest(args);
  if (request.options) return land(request.options);
  if (request.error) console.error(`[land] ${request.error}\n`);
  console.log(HELP);
  return request.error ? 1 : 0;
}

function commitPartCommand(args) {
  if (args.length) return commitPart(args);
  console.log(HELP);
  return 0;
}

const COMMANDS = {
  land: landCommand,
  "commit-part": commitPartCommand,
  wait: (args) => waitCommand(args),
  sync: () => sync(),
  try: (args) => tryCi({ wait: args.includes("--wait"), clean: args.includes("--clean") }),
  pending,
  "check-push": () => checkPush(),
  "check-commit": () => checkCommit(),
};

export async function main(argv) {
  if (!argv.length || argv.includes("--help") || argv.includes("-h")) {
    console.log(HELP);
    return 0;
  }
  const run = COMMANDS[argv[0]];
  if (!run) {
    console.error(`[mq] 没有 ${argv[0]} 这个命令。\n`);
    console.log(HELP);
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
