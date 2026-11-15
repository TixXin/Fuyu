#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHELL_TOOLS = ["Bash", "PowerShell"];
const HEAVY = /(^|[\s;&|(`])(cargo(\s+\+\S+)?\s+(build|test|check|clippy|nextest|run|bench)\b|tauri(\.cmd)?\s+build\b)/;
const QUEUED = /(\bpnpm\s+(-s\s+|--silent\s+)?heavy\b|scripts[\\/]heavy[\\/]heavy\.mjs)/;
const TARGET = /CARGO_TARGET_DIR\s*=\s*["']?([^\s"';]+)/g;
const MOVES_INTO_TEMP = /(\bcd|\bpushd|Set-Location|--manifest-path)[\s=]+["']?[^\s;&|"']*(scratchpad|claude-\d+[\\/]|[\\/]tmp[\\/]|[\\/]Temp[\\/])/i;
const ASSIGN = /(?:^|[\s;&])(?:export\s+)?(\w+)=["']?([^\s;&|"']+)/g;

export function expandVars(text) {
  const vars = new Map([...text.matchAll(ASSIGN)].map((match) => [match[1], match[2]]));
  return text.replace(/\$\{?(\w+)\}?/g, (whole, name) => vars.get(name) ?? whole);
}

const inCopy = (text) => MOVES_INTO_TEMP.test(expandVars(text));
const SHARED_TARGETS = /(^|[\\/])target[\\/](agents|debug|release)[\\/]?$/;

export function ownTargets(command) {
  return [...command.matchAll(TARGET)].map((match) => match[1]).filter((dir) => !SHARED_TARGETS.test(dir.replaceAll("\\", "/")));
}

export function heavyGate(command, env = process.env) {
  if (env.FUYU_HEAVY_GATE === "off") return null;
  const text = String(command ?? "");
  if (!HEAVY.test(text)) return null;
  const own = ownTargets(text);
  if (own.length) {
    return `这条命令把 Rust 编译结果放进了自己的目录（${own.join("、")}），会从零编译、和别的会话抢 CPU。改用共用的 src-tauri/target/agents（不写 CARGO_TARGET_DIR 时 pnpm heavy 和 build:exe 默认就用它），见 AGENTS.md「多会话的构建」。`;
  }
  if (inCopy(text)) {
    return "不要在临时目录里的仓库副本上跑 cargo / tauri build：副本没有 rust-toolchain.toml、编译缓存也用不上，每份都从零编译。在主工作区里用 pnpm heavy -- <命令> 跑，别的会话没提交的改动让检查报错时，在交接里写明哪些失败不是你造成的。";
  }
  if (QUEUED.test(text)) return null;
  return "cargo build/test/check/clippy 和 tauri build 要排队跑：改成 pnpm heavy -- <原来的命令>（这台机器同时最多跑两个重任务，其余的排队，轮到了自动开始）。pnpm build:exe、pnpm verify、pnpm test:regression 已经自带排队，直接用。";
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(0);
  }
  if (!SHELL_TOOLS.includes(input.tool_name)) process.exit(0);
  const message = heavyGate(input.tool_input?.command);
  if (message) {
    process.stderr.write(`${message}\n`);
    process.exit(2);
  }
}
