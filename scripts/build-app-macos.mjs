import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { mainCheckout, targetDir } from "./build-dirs.mjs";
import { backgroundBuildEnv } from "./build-load.mjs";

export const APP_NAME = "Fuyu.app";

export function installApp(source, applications = path.join(homedir(), "Applications")) {
  mkdirSync(applications, { recursive: true });
  const app = path.join(applications, APP_NAME);
  const incoming = `${app}.new`;
  const outgoing = `${app}.old`;
  rmSync(incoming, { recursive: true, force: true });
  rmSync(outgoing, { recursive: true, force: true });
  cpSync(source, incoming, { recursive: true, verbatimSymlinks: true });
  if (existsSync(app)) renameSync(app, outgoing);
  try {
    renameSync(incoming, app);
  } catch (error) {
    if (existsSync(outgoing) && !existsSync(app)) renameSync(outgoing, app);
    throw error;
  }
  rmSync(outgoing, { recursive: true, force: true });
  return app;
}

export const BUNDLE_CONFIG = "src-tauri/tauri.bundle-macos.conf.json";

export function buildApp(releaseDir) {
  const bundle = path.join(releaseDir, "bundle", "macos", APP_NAME);
  const status = spawnSync(`node scripts/macos/mediaremote-adapter.mjs && pnpm tauri build --bundles app --config ${BUNDLE_CONFIG}`, {
    shell: true,
    stdio: "inherit",
    env: { ...process.env, CARGO_TARGET_DIR: targetDir(mainCheckout()), ...backgroundBuildEnv() },
  }).status;
  if (status !== 0 || !existsSync(bundle)) {
    console.error("[build:exe] the build failed; ~/Applications is unchanged.");
    return 1;
  }
  if (process.env.FUYU_SYNC_SHORTCUT !== "1") {
    console.log(`[build:exe] built ${bundle}; ~/Applications is unchanged (set FUYU_SYNC_SHORTCUT=1 to install it there).`);
    return 0;
  }
  const app = installApp(bundle);
  console.log(`[build:exe] built ${bundle} and installed it as ${app}. A running island keeps running; the next start uses the new build.`);
  return 0;
}
