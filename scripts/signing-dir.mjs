import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function signingDir(home = homedir(), exists = existsSync) {
  const current = join(home, ".tauri", "fuyu");
  const legacy = join(home, ".tauri", "fly-island");
  return exists(current) || !exists(legacy) ? current : legacy;
}

export function signingConfigPath(env = process.env, home = homedir(), exists = existsSync) {
  return env.FUYU_SIGNING_CONFIG || env.FOCUSD_SIGNING_CONFIG || join(signingDir(home, exists), "release.json");
}
