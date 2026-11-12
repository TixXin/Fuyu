import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_NAME = "fuyu";

export function claudeProjectKey(dir) {
  return path.resolve(dir).replace(/[^A-Za-z0-9]/g, "-");
}

export function rewriteKeys(records, from, to) {
  const oldPrefix = path.resolve(from).toLowerCase();
  const newPrefix = path.resolve(to).toLowerCase();
  return Object.fromEntries(Object.entries(records).map(([key, value]) => [
    key === oldPrefix || key.startsWith(oldPrefix + path.sep) ? newPrefix + key.slice(oldPrefix.length) : key,
    value,
  ]));
}

export function planRename({ main, name = DEFAULT_NAME, claudeProjects = path.join(homedir(), ".claude", "projects") }) {
  const parent = path.dirname(main);
  const oldName = path.basename(main);
  const oldLanes = path.join(parent, `${oldName}-lanes`);
  const newMain = path.join(parent, name);
  const newLanes = path.join(parent, `${name}-lanes`);
  const lanes = existsSync(oldLanes) ? readdirSync(oldLanes).filter((entry) => /^\d+$/.test(entry)) : [];
  const projects = [[main, newMain], ...lanes.map((lane) => [path.join(oldLanes, lane), path.join(newLanes, lane)])]
    .map(([from, to]) => [path.join(claudeProjects, claudeProjectKey(from)), path.join(claudeProjects, claudeProjectKey(to))])
    .filter(([from]) => existsSync(from));
  return { oldName, main, oldLanes, newMain, newLanes, lanes, projects };
}

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function problems(plan) {
  const found = [];
  if (plan.oldName === path.basename(plan.newMain)) found.push(`已经叫 ${plan.oldName} 了`);
  for (const target of [plan.newMain, plan.newLanes]) if (existsSync(target)) found.push(`${target} 已存在`);
  if (git(["status", "--porcelain", "--untracked-files=no"], plan.main)) found.push("主工作区有未提交的改动");
  const inside = path.resolve(process.cwd()).toLowerCase();
  for (const dir of [plan.main, plan.oldLanes]) {
    const prefix = path.resolve(dir).toLowerCase();
    if (inside === prefix || inside.startsWith(prefix + path.sep)) found.push(`请在 ${dir} 外面运行（当前目录在里面）`);
  }
  return found;
}

function renameBoth(plan) {
  renameSync(plan.main, plan.newMain);
  if (!existsSync(plan.oldLanes)) return;
  try {
    renameSync(plan.oldLanes, plan.newLanes);
  } catch (error) {
    renameSync(plan.newMain, plan.main);
    throw new Error(`改不了 ${plan.oldLanes} 的名字（还有进程在用？），主工作区已改回原名：${error.message}`);
  }
}

function fixGit(plan) {
  const lanePaths = plan.lanes.map((lane) => path.join(plan.newLanes, lane));
  if (lanePaths.length) git(["worktree", "repair", ...lanePaths], plan.newMain);
  const hooks = git(["config", "--local", "--get", "core.hooksPath"], plan.newMain);
  if (hooks && path.resolve(hooks).toLowerCase().startsWith(path.resolve(plan.main).toLowerCase())) {
    git(["config", "--local", "core.hooksPath", path.join(plan.newMain, path.relative(plan.main, hooks))], plan.newMain);
  }
  const queue = path.join(plan.newMain, ".git", "claude-code-merge-queue");
  for (const file of ["lane-owners.json", "lane-sessions.json"]) {
    const full = path.join(queue, file);
    if (!existsSync(full)) continue;
    const records = rewriteKeys(rewriteKeys(JSON.parse(readFileSync(full, "utf8")), plan.oldLanes, plan.newLanes), plan.main, plan.newMain);
    writeFileSync(full, `${JSON.stringify(records, null, 2)}\n`);
  }
}

function copyProjects(plan) {
  for (const [from, to] of plan.projects) cpSync(from, to, { recursive: true, force: false, errorOnExist: false });
}

function install(plan) {
  for (const dir of [plan.newMain, ...plan.lanes.map((lane) => path.join(plan.newLanes, lane))]) {
    try {
      execFileSync("pnpm", ["install", "--frozen-lockfile"], { cwd: dir, shell: process.platform === "win32", stdio: ["ignore", "pipe", "pipe"] });
      console.log(`  pnpm install: ${dir}`);
    } catch {
      console.log(`  pnpm install 失败，之后手动跑：${dir}`);
    }
  }
}

function describe(plan) {
  return [
    `主工作区   ${plan.main} → ${plan.newMain}`,
    `lane 文件夹 ${plan.oldLanes} → ${plan.newLanes}（${plan.lanes.length} 个 lane：${plan.lanes.join("、") || "无"}）`,
    "git        worktree repair、core.hooksPath、lane 归属记录里的路径",
    `Claude     复制 ${plan.projects.length} 个项目目录（记忆和会话历史），旧的保留`,
    "依赖       主工作区和每个 lane 重新 pnpm install",
  ];
}

const NEXT_STEPS = [
  "在新的主工作区跑 pnpm build:exe（桌面快捷方式改指新路径；Rust 会全量重编一次）",
  "Orca / VS Code / magpie 里的工作区路径改成新文件夹，从新文件夹开会话",
  "岛上的任务看板插件：设置里的仓库目录改成新路径",
  "新会话里更新记忆中写着旧路径的条目",
];

function main(args) {
  const options = {};
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--name" || args[i] === "--claude-projects") options[args[i]] = args[(i += 1)];
    else if (!args[i].startsWith("--")) positional.push(args[i]);
  }
  const repo = positional[0] ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const top = git(["rev-parse", "--show-toplevel"], repo);
  const mainTop = path.dirname(path.resolve(top, git(["rev-parse", "--git-common-dir"], top)));
  const plan = planRename({ main: mainTop, name: options["--name"] ?? DEFAULT_NAME, ...(options["--claude-projects"] ? { claudeProjects: options["--claude-projects"] } : {}) });
  for (const line of describe(plan)) console.log(line);
  const found = problems(plan);
  if (found.length) {
    for (const problem of found) console.error(`✗ ${problem}`);
    return 1;
  }
  if (!args.includes("--apply")) {
    console.log("\n以上是演练。确认所有会话、pnpm tauri dev、岛屿和编辑器都已关闭后，加 --apply 执行。");
    return 0;
  }
  renameBoth(plan);
  console.log("✓ 文件夹已改名");
  fixGit(plan);
  console.log("✓ git 已修好");
  copyProjects(plan);
  console.log("✓ Claude 项目目录已复制");
  install(plan);
  console.log(`\n完成。接下来：\n${NEXT_STEPS.map((step, i) => `  ${i + 1}. ${step}`).join("\n")}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`[rename] ${error.message}`);
    process.exitCode = 1;
  }
}
