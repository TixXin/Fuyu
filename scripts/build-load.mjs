// Keeps the agents' builds (land-check / `pnpm verify`, `pnpm build:exe`, lane
// previews) from making the desktop stutter. Several lanes can compile at once,
// next to the user's `pnpm tauri dev`, each into its own target dir (build-dirs.mjs),
// and cargo starts one rustc per logical CPU in each of them.
//
//   - Below-normal priority: the build still uses idle CPU at full speed, but
//     yields to whatever the user is doing. Windows hands a below-normal priority
//     class down to the processes it starts (pnpm, cargo, rustc, the linker).
//   - CARGO_BUILD_JOBS: half the logical CPUs, so two builds at once do not
//     oversubscribe the machine. A CARGO_BUILD_JOBS already set wins.
//
// The user's own `pnpm tauri dev` does not come through here and keeps full speed.
import os from "node:os";

/** How many rustc jobs one background build may run on a machine with `cpus` logical CPUs. */
export function backgroundJobs(cpus = os.availableParallelism()) {
  return Math.max(2, Math.floor(cpus / 2));
}

/** The env additions for a background cargo build, given the current `env`. */
export function backgroundBuildEnv(env = process.env, cpus = os.availableParallelism()) {
  return env.CARGO_BUILD_JOBS ? {} : { CARGO_BUILD_JOBS: String(backgroundJobs(cpus)) };
}

/** Lowers this process to below-normal priority, so everything it starts inherits it. */
export function lowerPriority(tag) {
  try {
    os.setPriority(process.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
  } catch (error) {
    console.warn(`[${tag}] could not lower the build's priority: ${error.message}`);
  }
}
