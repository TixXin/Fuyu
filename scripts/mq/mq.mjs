import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkPush } from "./checkPush.mjs";
import { land } from "./land.mjs";
import { mainCheckoutOf } from "./settings.mjs";
import { sync } from "./sync.mjs";
import { waitCommand } from "./wait.mjs";

async function reconcile() {
  const { strandedLines } = await import("../lanes/session-hint.mjs");
  const lines = strandedLines(mainCheckoutOf());
  console.log(lines.length ? lines.join("\n") : "[reconcile] 没有被遗弃的 lane：有工作的 lane 都有会话在用。");
  return 0;
}

const COMMANDS = {
  land: (args) => land({ wait: args.includes("--wait") }),
  wait: (args) => waitCommand(args),
  sync: () => sync(),
  reconcile,
  "check-push": () => checkPush(),
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
