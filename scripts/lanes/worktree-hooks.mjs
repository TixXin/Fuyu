import path from "node:path";
import { fileURLToPath } from "node:url";
import { mainCheckout } from "../build-dirs.mjs";
import { currentSession, laneOf } from "./laneRegistry.mjs";
import { finishLane, openLane } from "./lanePool.mjs";

function repoMain() {
  return mainCheckout(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."));
}

export function createWorktree(input, { main = repoMain(), env = process.env, open = openLane, sessionsDir } = {}) {
  const session = input.session_id ?? env.CLAUDE_CODE_SESSION_ID ?? null;
  const known = currentSession({ ...env, CLAUDE_CODE_SESSION_ID: session ?? "" }, ...(sessionsDir ? [sessionsDir] : []));
  const lane = open({
    main,
    fromCwd: input.cwd ?? null,
    pid: Number(env.CLAUDE_PID) || known.pid || null,
    session,
    name: known.name,
    install: true,
  });
  return { code: 0, stdout: lane.wt };
}

export function removeWorktree(input, { main = repoMain(), finish = finishLane } = {}) {
  const lane = input.worktree_path ? laneOf(main, input.worktree_path) : null;
  if (!lane) return { code: 0, stderr: `[lanes] ${input.worktree_path ?? "?"} 不是 lane，不处理` };
  const result = finish(main, lane);
  if (result.released) return { code: 0, stderr: `[lanes] lane ${lane} 已释放，目录留着给下一个会话复用` };
  const files = (result.files ?? []).map((file) => `\n    ${file}`).join("");
  return { code: 1, stderr: `[lanes] lane ${lane} 有没合入的工作，不删：${result.problems.join("；")}${files}\n先提交并 pnpm mq:land，或 ExitWorktree(action="keep") 留着。` };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(event) {
  let input = {};
  try {
    input = JSON.parse(await readStdin());
  } catch {
    input = {};
  }
  const handler = { create: createWorktree, remove: removeWorktree }[event];
  if (!handler) {
    console.error("用法：node scripts/lanes/worktree-hooks.mjs <create|remove>");
    return 1;
  }
  const result = handler(input);
  if (result.stdout) process.stdout.write(`${result.stdout}\n`);
  if (result.stderr) process.stderr.write(`${result.stderr}\n`);
  return result.code;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await main(process.argv[2]);
  } catch (error) {
    console.error(`[lanes] ${error.message}`);
    process.exitCode = 1;
  }
}
