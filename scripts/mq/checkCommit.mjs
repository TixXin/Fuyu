import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { INTEGRATION_BRANCH, tryGit } from "./settings.mjs";

export const WHOLE_INDEX_ENV = "FUYU_COMMIT_WHOLE_INDEX";
export const SEQUENCES = ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply"];

export function commitBlock({ indexFile, branch, inSequence, env }) {
  if (env[WHOLE_INDEX_ENV] === "1" || branch !== INTEGRATION_BRANCH || inSequence) return null;
  if (/next-index-\d+\.lock$/.test(indexFile ?? "")) return null;
  return [
    "",
    `✋ 在 ${INTEGRATION_BRANCH} 上提交要写清文件：git commit -m "…" -- <文件…>（新文件先 git add <文件>）。`,
    "   这份工作区是几个会话共用的，不写文件名会把别的会话暂存的改动一起提交。",
    "   同一个文件里只带自己的那几处：pnpm mq:commit-part --list <文件>，再 --take <文件>:<编号,…>，不用手写 GIT_INDEX_FILE。",
    `   确实要提交整个暂存区：${WHOLE_INDEX_ENV}=1 git commit …`,
    "",
  ].join("\n");
}

function realDir(dir) {
  try {
    return realpathSync(dir);
  } catch {
    return path.resolve(dir);
  }
}

export function customIndexNote({ indexFile, gitDir, branch, inSequence }) {
  if (!indexFile || branch !== INTEGRATION_BRANCH || inSequence) return null;
  if (realDir(path.dirname(path.resolve(indexFile))) === realDir(gitDir)) return null;
  return [
    "",
    "提醒：这次提交用了自定义的 GIT_INDEX_FILE（没有拦）。",
    "   临时索引要是照旧的 HEAD 搭的，这次提交会把之后别人提交的改动冲回去；提交完共用索引也不会对齐。",
    "   同一个文件里只带自己的改动用 pnpm mq:commit-part：它核对 HEAD、提交后对齐索引。",
    "",
  ].join("\n");
}

export function checkCommit(env = process.env) {
  const gitDir = tryGit(["rev-parse", "--absolute-git-dir"]).out.trim();
  const context = {
    indexFile: env.GIT_INDEX_FILE,
    gitDir,
    branch: tryGit(["rev-parse", "--abbrev-ref", "HEAD"]).out.trim(),
    inSequence: SEQUENCES.some((name) => existsSync(path.join(gitDir, name))),
    env,
  };
  const block = commitBlock(context);
  if (block) {
    console.error(block);
    return 1;
  }
  const note = customIndexNote(context);
  if (note) console.error(note);
  return 0;
}
