import os from "node:os";

export function backgroundJobs(cpus = os.availableParallelism()) {
  return Math.max(2, Math.floor(cpus / 2));
}

export function backgroundBuildEnv(env = process.env, cpus = os.availableParallelism()) {
  return env.CARGO_BUILD_JOBS ? {} : { CARGO_BUILD_JOBS: String(backgroundJobs(cpus)) };
}

export function lowerPriority(tag) {
  try {
    os.setPriority(process.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
  } catch (error) {
    console.warn(`[${tag}] could not lower the build's priority: ${error.message}`);
  }
}
