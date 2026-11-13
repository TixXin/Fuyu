import { execFileSync } from "node:child_process";
import path from "node:path";

export const INTEGRATION_BRANCH = "main";
export const CHECK_COMMAND = "node scripts/land-check.mjs --light";
export const LOCKFILES = ["pnpm-lock.yaml"];
export const EMERGENCY_ENV = "CLAUDE_CODE_MERGE_QUEUE_EMERGENCY_PUSH";

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

export function mainCheckoutOf(cwd = process.cwd()) {
  return path.dirname(path.resolve(cwd, git(["rev-parse", "--git-common-dir"], cwd)));
}
