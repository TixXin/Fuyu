import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import path from "node:path";

export const INTEGRATION_BRANCH = "main";
export const LANE_BRANCH_PREFIX = "lane/";
export const CHECK_COMMAND = "node scripts/land-check.mjs";
export const ON_LAND = ["scripts/land-sync-dev.mjs"];
export const LOCKFILES = ["pnpm-lock.yaml"];
export const LANDING_ENV = "CLAUDE_CODE_MERGE_QUEUE_LANDING";
export const EMERGENCY_ENV = "CLAUDE_CODE_MERGE_QUEUE_EMERGENCY_PUSH";
export const DATA_DIR = "claude-code-merge-queue";

export function git(args, cwd = process.cwd()) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function tryGit(args, cwd = process.cwd()) {
  try {
    return { ok: true, out: git(args, cwd) };
  } catch (error) {
    return { ok: false, out: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

export function dataDir(cwd = process.cwd()) {
  return path.join(realpathSync(path.resolve(cwd, git(["rev-parse", "--git-common-dir"], cwd))), DATA_DIR);
}

export function mainCheckoutOf(cwd = process.cwd()) {
  return path.dirname(path.resolve(cwd, git(["rev-parse", "--git-common-dir"], cwd)));
}
