import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mainCheckout } from "../build-dirs.mjs";

export const LANE_HOOKS = [
  { event: "SessionStart", script: "session-hint.mjs", timeout: 10 },
  { event: "SessionEnd", script: "session-end.mjs", timeout: 30 },
];

const MAC_PATH = "/opt/homebrew/bin:/usr/local/bin";

export function settingsFile(env = process.env) {
  return path.join(env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"), "settings.json");
}

export function hookCommand(main, script, platform = process.platform) {
  const file = `${main.replaceAll("\\", "/").replace(/\/+$/, "")}/scripts/lanes/${script}`;
  if (/["'$`]/.test(file)) throw new Error(`主工作区路径里有引号或 $，没法写成钩子命令：${file}`);
  if (platform === "darwin") return `sh -c 'PATH="$PATH:${MAC_PATH}" exec node "${file}"'`;
  return `node "${file}"`;
}

function isLaneHook(hook, script) {
  return typeof hook?.command === "string" && new RegExp(`scripts[\\\\/]+lanes[\\\\/]+${script.replace(".", "\\.")}`).test(hook.command);
}

export function planHooks(settings, main, platform = process.platform) {
  const next = structuredClone(settings ?? {});
  const changes = [];
  next.hooks ??= {};
  for (const { event, script, timeout } of LANE_HOOKS) {
    const wanted = { type: "command", command: hookCommand(main, script, platform), timeout };
    const groups = Array.isArray(next.hooks[event]) ? next.hooks[event] : [];
    let found = false;
    for (const group of groups) {
      if (!Array.isArray(group?.hooks)) continue;
      group.hooks = group.hooks.filter((hook) => {
        if (!isLaneHook(hook, script)) return true;
        if (found) {
          changes.push(`${event}：删掉重复的 ${hook.command}`);
          return false;
        }
        found = true;
        if (hook.command !== wanted.command || hook.timeout !== timeout || hook.type !== "command") {
          changes.push(`${event}：${hook.command} → ${wanted.command}`);
          Object.assign(hook, wanted);
        }
        return true;
      });
    }
    const kept = groups.filter((group) => !Array.isArray(group?.hooks) || group.hooks.length);
    if (!found) {
      kept.push({ hooks: [wanted] });
      changes.push(`${event}：加上 ${wanted.command}`);
    }
    next.hooks[event] = kept;
  }
  return { settings: next, changes };
}

function readSettings(file) {
  if (!fs.existsSync(file)) return { settings: {}, raw: null };
  const raw = fs.readFileSync(file, "utf8");
  try {
    return { settings: JSON.parse(raw), raw };
  } catch (error) {
    throw new Error(`${file} 不是有效的 JSON，没有改动：${error.message}`);
  }
}

function stamp(now = new Date()) {
  return now.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "");
}

export function installHooks({ main, file = settingsFile(), platform = process.platform, check = false, now = new Date() }) {
  const { settings, raw } = readSettings(file);
  const { settings: next, changes } = planHooks(settings, main, platform);
  if (check || !changes.length) return { file, changes, backup: null, written: false };
  let backup = null;
  if (raw !== null) {
    backup = `${file}.bak-lane-hooks-${stamp(now)}`;
    fs.writeFileSync(backup, raw);
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
  return { file, changes, backup, written: true };
}

function main(argv) {
  const check = argv.includes("--check");
  const root = mainCheckout(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."));
  const result = installHooks({ main: root, check });
  if (!result.changes.length) {
    console.log(`[lanes] ${result.file} 里的 lane 钩子已经指向 ${root}，不用改`);
    return 0;
  }
  for (const change of result.changes) console.log(`  ${change}`);
  if (check) {
    console.log(`[lanes] ${result.file} 要改上面 ${result.changes.length} 处；运行 pnpm lane:install-hooks 写入`);
    return 1;
  }
  console.log(`[lanes] 已写入 ${result.file}${result.backup ? `，原文件备份在 ${result.backup}` : ""}。新开的会话才会用上`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`[lanes] ${error.message}`);
    process.exitCode = 1;
  }
}
