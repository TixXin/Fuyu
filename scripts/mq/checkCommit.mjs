import { existsSync } from "node:fs";
import path from "node:path";
import { INTEGRATION_BRANCH, tryGit } from "./settings.mjs";

export const WHOLE_INDEX_ENV = "FUYU_COMMIT_WHOLE_INDEX";
const SEQUENCES = ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply"];

export function commitBlock({ indexFile, branch, inSequence, env }) {
  if (env[WHOLE_INDEX_ENV] === "1" || branch !== INTEGRATION_BRANCH || inSequence) return null;
  if (/next-index-\d+\.lock$/.test(indexFile ?? "")) return null;
  return [
    "",
    `✋ 在 ${INTEGRATION_BRANCH} 上提交要写清文件：git commit -m "…" -- <文件…>（新文件先 git add <文件>）。`,
    "   这份工作区是几个会话共用的，不写文件名会把别的会话暂存的改动一起提交。",
    `   确实要提交整个暂存区：${WHOLE_INDEX_ENV}=1 git commit …`,
    "",
  ].join("\n");
}

export function checkCommit(env = process.env) {
  const gitDir = tryGit(["rev-parse", "--absolute-git-dir"]).out.trim();
  const block = commitBlock({
    indexFile: env.GIT_INDEX_FILE,
    branch: tryGit(["rev-parse", "--abbrev-ref", "HEAD"]).out.trim(),
    inSequence: SEQUENCES.some((name) => existsSync(path.join(gitDir, name))),
    env,
  });
  if (!block) return 0;
  console.error(block);
  return 1;
}
