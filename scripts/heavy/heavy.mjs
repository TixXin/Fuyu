#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { backgroundBuildEnv } from "../build-load.mjs";
import { pruneMainTarget } from "../prune-build-cache.mjs";
import { acquire, DEFAULT_CARGO_TARGET_DIR, explicitCargoTargetDir, HEAVY_ENV, isCargoBuild, laneOf, queueDir, slotCount } from "./queue.mjs";

export function parseArgs(argv) {
  const split = argv.indexOf("--");
  const own = split === -1 ? [] : argv.slice(0, split);
  const command = split === -1 ? argv : argv.slice(split + 1);
  const at = own.indexOf("--label");
  const label = at === -1 ? null : own[at + 1] ?? null;
  const laneAt = own.indexOf("--lane");
  const lane = laneAt === -1 ? null : own[laneAt + 1] ?? null;
  return { label: label ?? command.join(" ").slice(0, 60), lane, command };
}

export function run(argv, env = process.env, { afterJob = () => pruneMainTarget({ quiet: true }), spawn = spawnSync, log = console.log } = {}) {
  const { label, lane, command } = parseArgs(argv);
  if (!command.length) {
    console.error("用法：pnpm heavy [--label <名字>] [--lane <构建目录>] -- <命令…>");
    return 2;
  }
  const defaultTarget = isCargoBuild(command) && !explicitCargoTargetDir(command, env);
  if (defaultTarget) {
    log(`[heavy] 未指定构建目录，默认设 CARGO_TARGET_DIR=${DEFAULT_CARGO_TARGET_DIR}`);
  }
  const jobEnv = {
    ...env,
    [HEAVY_ENV]: "1",
    ...backgroundBuildEnv(env),
    ...(defaultTarget ? { CARGO_TARGET_DIR: DEFAULT_CARGO_TARGET_DIR } : {}),
  };
  const options = { stdio: "inherit", shell: process.platform === "win32", env: jobEnv };
  if (env[HEAVY_ENV] === "1") return spawn(command[0], command.slice(1), options).status ?? 1;
  const release = acquire({ label, lane: lane ?? laneOf(command, jobEnv), dir: queueDir(jobEnv), slots: slotCount(jobEnv), log });
  try {
    const result = spawn(command[0], command.slice(1), options);
    if (result.error) console.error(`[heavy] 启动失败：${result.error.message}`);
    return result.status ?? 1;
  } finally {
    release();
    afterJob();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(run(process.argv.slice(2)));
}
