import { execFileSync, spawnSync } from "node:child_process";
import os from "node:os";

export function efficiencyCores(platform = process.platform) {
  if (platform !== "darwin") return 0;
  try {
    return Number(execFileSync("sysctl", ["-n", "hw.perflevel1.logicalcpu"], { encoding: "utf8" }).trim()) || 0;
  } catch {
    return 0;
  }
}

export function backgroundJobs(cpus = os.availableParallelism(), efficiency = efficiencyCores()) {
  if (efficiency > 0) return Math.max(2, efficiency);
  return Math.max(2, Math.floor(cpus / 2));
}

export function backgroundBuildEnv(env = process.env, cpus = os.availableParallelism(), efficiency = efficiencyCores()) {
  return env.CARGO_BUILD_JOBS ? {} : { CARGO_BUILD_JOBS: String(backgroundJobs(cpus, efficiency)) };
}

export function lowerPriority(tag) {
  try {
    os.setPriority(process.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
  } catch (error) {
    console.warn(`[${tag}] could not lower the build's priority: ${error.message}`);
  }
  if (process.platform !== "darwin") return;
  const result = spawnSync("taskpolicy", ["-b", "-p", String(process.pid)], { encoding: "utf8" });
  if (result.status !== 0) console.warn(`[${tag}] could not move the build to the background tier: ${result.error?.message ?? result.stderr.trim()}`);
}
