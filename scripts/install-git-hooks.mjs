import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const HOOKS_PATH = ".githooks";

export function hooksPathAction(current) {
  const value = (current ?? "").trim();
  if (value.replace(/[\\/]+$/, "").split(/[\\/]/).pop() === HOOKS_PATH) return "keep";
  if (!value) return "set";
  return "foreign";
}

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

function readHooksPath(cwd) {
  try {
    return git(["config", "--local", "--get", "core.hooksPath"], cwd);
  } catch {
    return "";
  }
}

export function installGitHooks(cwd) {
  try {
    if (git(["rev-parse", "--is-inside-work-tree"], cwd).trim() !== "true") return "skip";
  } catch {
    return "skip";
  }
  const current = readHooksPath(cwd).trim();
  const action = hooksPathAction(current);
  if (action === "set") {
    git(["config", "--local", "core.hooksPath", HOOKS_PATH], cwd);
    console.log(`[git-hooks] core.hooksPath → ${HOOKS_PATH}（pre-push、commit-msg 已启用）`);
  } else if (action === "foreign") {
    console.warn(`[git-hooks] core.hooksPath 已经是 ${current}，没有改；要用本仓库的钩子运行 git config core.hooksPath ${HOOKS_PATH}`);
  }
  return action;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    installGitHooks(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
  } catch (error) {
    console.warn(`[git-hooks] 没能设置 core.hooksPath：${error.message}`);
  }
}
