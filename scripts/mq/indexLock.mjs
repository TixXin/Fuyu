import { existsSync } from "node:fs";
import path from "node:path";
import { git } from "./settings.mjs";

export const LOCK_ERROR = /index\.lock|Unable to create|another git process/i;
export const LOCK_WAIT = { tries: 60, ms: 500 };

export function pause(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function lockFile(cwd) {
  return path.resolve(cwd, git(["rev-parse", "--git-path", "index.lock"], cwd));
}

export function waitForIndex(cwd, { tries, ms } = LOCK_WAIT) {
  const file = lockFile(cwd);
  for (let i = 0; i < tries && existsSync(file); i += 1) pause(ms);
  return !existsSync(file);
}

export function retryOnLock(run, { tries, ms } = LOCK_WAIT) {
  let result = run();
  for (let i = 0; i < tries && !result.ok && LOCK_ERROR.test(result.out); i += 1) {
    pause(ms);
    result = run();
  }
  return result;
}
